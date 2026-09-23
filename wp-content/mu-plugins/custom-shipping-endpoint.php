<?php
/**
 * Plugin Name: MyApp Shiprocket & Shipping Tracking Endpoints
 * Description: Custom REST API endpoints to receive Shiprocket tracking webhooks, save tracking metadata to WooCommerce orders, and securely expose tracking to the headless Next.js frontend.
 * Version: 1.0.0
 * Author: Siva
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Retrieve the configured persistent cart / internal API AUTH_KEY.
 *
 * @return string
 */
if (!function_exists('myapp_get_shipping_cart_auth_key')) {
    function myapp_get_shipping_cart_auth_key() {
        if (defined('MYAPP_CART_AUTH_KEY') && is_string(MYAPP_CART_AUTH_KEY) && MYAPP_CART_AUTH_KEY !== '') {
            return MYAPP_CART_AUTH_KEY;
        }

        $env_key = getenv('MYAPP_CART_AUTH_KEY');
        if ($env_key !== false && is_string($env_key) && $env_key !== '') {
            return $env_key;
        }

        if (defined('AUTH_KEY') && is_string(AUTH_KEY) && AUTH_KEY !== '') {
            return AUTH_KEY;
        }

        return '';
    }
}

/**
 * Validate internal API request auth key against configured secret.
 *
 * @param WP_REST_Request $request
 * @return bool
 */
if (!function_exists('myapp_validate_shipping_internal_auth')) {
    function myapp_validate_shipping_internal_auth(WP_REST_Request $request) {
        $configured_key = myapp_get_shipping_cart_auth_key();
        if (empty($configured_key)) {
            return false;
        }

        $provided_key = $request->get_param('AUTH_KEY');
        if (empty($provided_key)) {
            $provided_key = $request->get_header('x-auth-key');
        }
        if (empty($provided_key)) {
            $auth_header = $request->get_header('authorization');
            if (!empty($auth_header)) {
                if (stripos($auth_header, 'Bearer ') === 0) {
                    $provided_key = trim(substr($auth_header, 7));
                } else {
                    $provided_key = trim($auth_header);
                }
            }
        }

        if (empty($provided_key) || !is_string($provided_key)) {
            return false;
        }

        return hash_equals($configured_key, $provided_key);
    }
}

/**
 * Retrieve the configured Shiprocket Webhook Secret.
 *
 * @return string
 */
function myapp_get_shiprocket_webhook_secret() {
    if (defined('SHIPROCKET_WEBHOOK_SECRET') && is_string(SHIPROCKET_WEBHOOK_SECRET) && SHIPROCKET_WEBHOOK_SECRET !== '') {
        return SHIPROCKET_WEBHOOK_SECRET;
    }

    $env_secret = getenv('SHIPROCKET_WEBHOOK_SECRET');
    if ($env_secret !== false && is_string($env_secret) && $env_secret !== '') {
        return $env_secret;
    }

    return '';
}

/**
 * Extract auth token from incoming webhook request.
 * Supports both 'x-api-key' and 'Authorization' headers as well as $_SERVER fallbacks.
 *
 * @param WP_REST_Request $request
 * @return string
 */
function myapp_extract_shiprocket_auth_token(WP_REST_Request $request) {
    // 1. Check 'x-api-key' header
    $x_api_key = $request->get_header('x-api-key');
    if (!empty($x_api_key) && is_string($x_api_key)) {
        return trim($x_api_key);
    }

    // 2. Check 'Authorization' header (raw token or Bearer token)
    $auth_header = $request->get_header('authorization');
    if (!empty($auth_header) && is_string($auth_header)) {
        if (stripos($auth_header, 'Bearer ') === 0) {
            return trim(substr($auth_header, 7));
        }
        return trim($auth_header);
    }

    // 3. Fallbacks from $_SERVER in case Apache/Nginx environment stripped headers
    if (!empty($_SERVER['HTTP_X_API_KEY']) && is_string($_SERVER['HTTP_X_API_KEY'])) {
        return trim($_SERVER['HTTP_X_API_KEY']);
    }

    if (!empty($_SERVER['HTTP_AUTHORIZATION']) && is_string($_SERVER['HTTP_AUTHORIZATION'])) {
        $server_auth = trim($_SERVER['HTTP_AUTHORIZATION']);
        if (stripos($server_auth, 'Bearer ') === 0) {
            return trim(substr($server_auth, 7));
        }
        return $server_auth;
    }

    if (!empty($_SERVER['REDIRECT_HTTP_AUTHORIZATION']) && is_string($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        $redir_auth = trim($_SERVER['REDIRECT_HTTP_AUTHORIZATION']);
        if (stripos($redir_auth, 'Bearer ') === 0) {
            return trim(substr($redir_auth, 7));
        }
        return $redir_auth;
    }

    return '';
}

/**
 * Find a WooCommerce order by Shiprocket channel_order_id.
 * Tries direct ID first, then order number meta, and custom order number plugins.
 *
 * @param string|int $channel_order_id
 * @return WC_Order|null
 */
function myapp_find_order_by_channel_id($channel_order_id) {
    if (empty($channel_order_id)) {
        return null;
    }

    // 1. Try as a numeric WC order ID
    $order_id_num = (int) $channel_order_id;
    if ($order_id_num > 0 && function_exists('wc_get_order')) {
        $order = wc_get_order($order_id_num);
        if ($order instanceof WC_Order) {
            return $order;
        }
    }

    // 2. Search by _order_number meta (Sequential Order Numbers / custom formatting)
    if (function_exists('wc_get_orders')) {
        $orders = wc_get_orders([
            'limit'      => 1,
            'meta_key'   => '_order_number',
            'meta_value' => (string) $channel_order_id,
        ]);
        if (!empty($orders) && $orders[0] instanceof WC_Order) {
            return $orders[0];
        }

        // 3. Fallback search by standard order number
        $orders = wc_get_orders([
            'limit'        => 1,
            'order_number' => (string) $channel_order_id,
        ]);
        if (!empty($orders) && $orders[0] instanceof WC_Order) {
            return $orders[0];
        }
    }

    return null;
}

/**
 * REST Callback: Handle incoming Shiprocket tracking webhook.
 * POST /wp-json/myapp/v1/shipping/shiprocket/webhook
 * POST /wp-json/myapp/v1/shipping/webhook
 *
 * @param WP_REST_Request $request
 * @return WP_REST_Response
 */
function myapp_handle_shiprocket_webhook(WP_REST_Request $request) {
    $expected_secret = myapp_get_shiprocket_webhook_secret();
    $sent_token = myapp_extract_shiprocket_auth_token($request);

    // If secret is not configured or token verification fails:
    // Always return HTTP 200 with status: ignored to avoid leaking validation details or causing retry storms
    if (empty($expected_secret) || empty($sent_token) || !hash_equals($expected_secret, $sent_token)) {
        error_log('[Shiprocket Webhook] Auth token validation failed or secret missing.');
        return new WP_REST_Response(['status' => 'ignored', 'reason' => 'unauthorized'], 200);
    }

    $raw_body = $request->get_body();
    $body = json_decode($raw_body, true);

    if (!is_array($body)) {
        return new WP_REST_Response(['status' => 'ignored', 'reason' => 'invalid_json'], 200);
    }

    // Extract channel order identifier
    $channel_order_id = $body['channel_order_id'] ?? ($body['order_id'] ?? '');
    if (empty($channel_order_id)) {
        return new WP_REST_Response(['status' => 'ignored', 'reason' => 'missing_order_id'], 200);
    }

    $order = myapp_find_order_by_channel_id($channel_order_id);
    if (!$order) {
        error_log('[Shiprocket Webhook] No matching order found for channel_order_id: ' . $channel_order_id);
        return new WP_REST_Response(['status' => 'ok', 'message' => 'order_not_found'], 200);
    }

    // Sanitize and extract tracking parameters
    $awb                = sanitize_text_field((string) ($body['awb'] ?? ''));
    $current_status     = sanitize_text_field((string) ($body['current_status'] ?? ($body['shipment_status'] ?? '')));
    $current_status_id  = intval($body['current_status_id'] ?? ($body['shipment_status_id'] ?? 0));
    $courier_name       = sanitize_text_field((string) ($body['courier_name'] ?? ''));
    $etd                = sanitize_text_field((string) ($body['etd'] ?? ''));
    $raw_scans          = isset($body['scans']) && is_array($body['scans']) ? $body['scans'] : [];

    // Sanitize scans array
    $sanitized_scans = [];
    foreach ($raw_scans as $scan) {
        if (!is_array($scan)) {
            continue;
        }
        $sanitized_scans[] = [
            'date'            => sanitize_text_field((string) ($scan['date'] ?? '')),
            'activity'        => sanitize_text_field((string) ($scan['activity'] ?? ($scan['status'] ?? ''))),
            'location'        => sanitize_text_field((string) ($scan['location'] ?? '')),
            'sr_status_label' => sanitize_text_field((string) ($scan['sr-status-label'] ?? ($scan['sr_status_label'] ?? ''))),
        ];
    }

    // Persist metadata on the WooCommerce Order
    if (!empty($awb)) {
        $order->update_meta_data('_myapp_shiprocket_awb', $awb);
    }
    if (!empty($current_status)) {
        $order->update_meta_data('_myapp_shiprocket_status', $current_status);
    }
    if ($current_status_id > 0) {
        $order->update_meta_data('_myapp_shiprocket_status_id', $current_status_id);
    }
    if (!empty($courier_name)) {
        $order->update_meta_data('_myapp_shiprocket_courier', $courier_name);
    }
    if (!empty($etd)) {
        $order->update_meta_data('_myapp_shiprocket_etd', $etd);
    }

    $order->update_meta_data('_myapp_shiprocket_scans', wp_json_encode($sanitized_scans));
    $order->update_meta_data('_myapp_shiprocket_updated_at', current_time('mysql'));
    $order->save();

    return new WP_REST_Response([
        'status'   => 'ok',
        'order_id' => $order->get_id(),
        'awb'      => $awb,
    ], 200);
}

/**
 * REST Callback: Retrieve shipment tracking details for an authenticated user.
 * GET /wp-json/myapp/v1/shipping/track/(?P<order_id>\d+)
 *
 * @param WP_REST_Request $request
 * @return WP_REST_Response
 */
function myapp_get_shipping_tracking_endpoint(WP_REST_Request $request) {
    if (!myapp_validate_shipping_internal_auth($request)) {
        return new WP_REST_Response([
            'success' => false,
            'message' => 'Unauthorized: Invalid or missing AUTH_KEY.',
        ], 401);
    }

    $order_id = (int) $request['order_id'];
    if ($order_id <= 0 || !function_exists('wc_get_order')) {
        return new WP_REST_Response([
            'success' => false,
            'error'   => 'not_found',
            'message' => 'Invalid order ID.',
        ], 404);
    }

    $order = wc_get_order($order_id);
    if (!$order instanceof WC_Order) {
        return new WP_REST_Response([
            'success' => false,
            'error'   => 'not_found',
            'message' => 'Order not found.',
        ], 404);
    }

    // Customer ownership validation
    $requested_user_id = intval($request->get_param('user_id'));
    $requested_email   = sanitize_email((string) $request->get_param('email'));

    $order_customer_id = (int) $order->get_customer_id();
    $order_billing_email = strtolower(trim((string) $order->get_billing_email()));

    $owns_order = false;
    if ($requested_user_id > 0 && $order_customer_id === $requested_user_id) {
        $owns_order = true;
    } elseif (!empty($requested_email) && $order_billing_email === strtolower(trim($requested_email))) {
        $owns_order = true;
    }

    if (!$owns_order) {
        return new WP_REST_Response([
            'success' => false,
            'error'   => 'forbidden',
            'message' => 'You do not have permission to view tracking for this order.',
        ], 403);
    }

    $awb        = (string) $order->get_meta('_myapp_shiprocket_awb');
    $status     = (string) $order->get_meta('_myapp_shiprocket_status');
    $status_id  = (int) $order->get_meta('_myapp_shiprocket_status_id');
    $courier    = (string) $order->get_meta('_myapp_shiprocket_courier');
    $etd        = (string) $order->get_meta('_myapp_shiprocket_etd');
    $raw_scans  = $order->get_meta('_myapp_shiprocket_scans');
    $updated_at = (string) $order->get_meta('_myapp_shiprocket_updated_at');

    $scans = [];
    if (!empty($raw_scans)) {
        $decoded = json_decode($raw_scans, true);
        if (is_array($decoded)) {
            $scans = $decoded;
        }
    }

    $has_tracking = !empty($awb) || !empty($status) || !empty($courier) || !empty($scans);

    return new WP_REST_Response([
        'success'      => true,
        'has_tracking' => $has_tracking,
        'order_id'     => $order->get_id(),
        'order_number' => $order->get_order_number(),
        'awb'          => $awb ?: null,
        'status'       => $status ?: null,
        'status_id'    => $status_id ?: null,
        'courier'      => $courier ?: null,
        'etd'          => $etd ?: null,
        'scans'        => $scans,
        'updated_at'   => $updated_at ?: null,
    ], 200);
}

/**
 * Register custom shipping REST routes.
 */
add_action('rest_api_init', function () {
    // 1. Provider-specific webhook route
    register_rest_route('myapp/v1', '/shipping/shiprocket/webhook', [
        'methods'             => 'POST',
        'callback'            => 'myapp_handle_shiprocket_webhook',
        'permission_callback' => '__return_true',
    ]);

    // 2. Generic shipping webhook route (safe alias to avoid panel keyword restrictions if needed)
    register_rest_route('myapp/v1', '/shipping/webhook', [
        'methods'             => 'POST',
        'callback'            => 'myapp_handle_shiprocket_webhook',
        'permission_callback' => '__return_true',
    ]);

    // 3. Frontend authenticated tracking read endpoint
    register_rest_route('myapp/v1', '/shipping/track/(?P<order_id>\d+)', [
        'methods'             => 'GET',
        'callback'            => 'myapp_get_shipping_tracking_endpoint',
        'permission_callback' => '__return_true',
    ]);
});
