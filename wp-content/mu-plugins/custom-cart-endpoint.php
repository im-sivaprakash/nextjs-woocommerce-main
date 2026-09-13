<?php
/**
 * Plugin Name: MyApp Persistent Cart Endpoint
 * Description: Custom REST API endpoints to save and retrieve customer persistent carts backed by user meta.
 * Version: 1.0.0
 * Author: Siva
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Retrieve the configured persistent cart AUTH_KEY.
 * Checks the MYAPP_CART_AUTH_KEY constant first, then falls back to environment variable.
 *
 * @return string
 */
function myapp_get_cart_auth_key() {
    if (defined('MYAPP_CART_AUTH_KEY') && is_string(MYAPP_CART_AUTH_KEY) && MYAPP_CART_AUTH_KEY !== '') {
        return MYAPP_CART_AUTH_KEY;
    }

    $env_key = getenv('MYAPP_CART_AUTH_KEY');
    if ($env_key !== false && is_string($env_key) && $env_key !== '') {
        return $env_key;
    }

    return '';
}

/**
 * Validate incoming AUTH_KEY against the configured secret using constant-time comparison.
 *
 * @param WP_REST_Request $request
 * @return bool
 */
function myapp_validate_cart_auth(WP_REST_Request $request) {
    $configured_key = myapp_get_cart_auth_key();
    if (empty($configured_key)) {
        return false;
    }

    $provided_key = $request->get_param('AUTH_KEY');
    if (empty($provided_key) || !is_string($provided_key)) {
        return false;
    }

    return hash_equals($configured_key, $provided_key);
}

/**
 * REST Callback: Save user cart to user meta.
 * POST /wp-json/myapp/v1/cart/save
 *
 * @param WP_REST_Request $request
 * @return WP_REST_Response
 */
function myapp_save_cart_endpoint(WP_REST_Request $request) {
    if (!myapp_validate_cart_auth($request)) {
        return new WP_REST_Response([
            'success' => false,
            'message' => 'Unauthorized: Invalid or missing AUTH_KEY.',
        ], 401);
    }

    $user_id = $request->get_param('user_id');
    if (empty($user_id) || !is_numeric($user_id)) {
        return new WP_REST_Response([
            'success' => false,
            'message' => 'Missing or invalid user_id.',
        ], 400);
    }

    $user_id = (int) $user_id;
    $user = get_userdata($user_id);
    if (!$user) {
        return new WP_REST_Response([
            'success' => false,
            'message' => 'User not found.',
        ], 400);
    }

    $items = $request->get_param('items');
    if (!is_array($items)) {
        return new WP_REST_Response([
            'success' => false,
            'message' => 'Invalid items payload; must be an array.',
        ], 400);
    }

    $sanitized_items = [];
    foreach ($items as $item) {
        if (!is_array($item) || !isset($item['id']) || !isset($item['quantity'])) {
            continue;
        }

        $sanitized_item = [
            'id'       => (int) $item['id'],
            'quantity' => (int) $item['quantity'],
        ];

        if (isset($item['variation']) && is_array($item['variation']) && !empty($item['variation'])) {
            $sanitized_variation = [];
            foreach ($item['variation'] as $var) {
                if (is_array($var) && isset($var['attribute']) && isset($var['value'])) {
                    $sanitized_variation[] = [
                        'attribute' => sanitize_text_field((string) $var['attribute']),
                        'value'     => sanitize_text_field((string) $var['value']),
                    ];
                }
            }
            if (!empty($sanitized_variation)) {
                $sanitized_item['variation'] = $sanitized_variation;
            }
        }

        $sanitized_items[] = $sanitized_item;
    }

    $cart_meta_data = [
        'items'      => $sanitized_items,
        'updated_at' => current_time('mysql'),
    ];

    update_user_meta($user_id, '_myapp_persistent_cart', $cart_meta_data);

    return new WP_REST_Response([
        'success' => true,
    ], 200);
}

/**
 * REST Callback: Retrieve user cart from user meta.
 * GET /wp-json/myapp/v1/cart/get
 *
 * @param WP_REST_Request $request
 * @return WP_REST_Response
 */
function myapp_get_cart_endpoint(WP_REST_Request $request) {
    if (!myapp_validate_cart_auth($request)) {
        return new WP_REST_Response([
            'success' => false,
            'message' => 'Unauthorized: Invalid or missing AUTH_KEY.',
        ], 401);
    }

    $user_id = $request->get_param('user_id');
    if (empty($user_id) || !is_numeric($user_id)) {
        return new WP_REST_Response([
            'success' => false,
            'message' => 'Missing or invalid user_id.',
        ], 400);
    }

    $user_id = (int) $user_id;
    $user = get_userdata($user_id);
    if (!$user) {
        return new WP_REST_Response([
            'success' => false,
            'message' => 'User not found.',
        ], 400);
    }

    $cart_meta_data = get_user_meta($user_id, '_myapp_persistent_cart', true);
    $items = [];

    if (is_array($cart_meta_data) && isset($cart_meta_data['items']) && is_array($cart_meta_data['items'])) {
        $items = $cart_meta_data['items'];
    }

    return new WP_REST_Response([
        'success' => true,
        'items'   => $items,
    ], 200);
}

/**
 * Register custom persistent cart REST routes.
 */
add_action('rest_api_init', function () {
    register_rest_route('myapp/v1', '/cart/save', [
        'methods'             => 'POST',
        'callback'            => 'myapp_save_cart_endpoint',
        'permission_callback' => '__return_true',
    ]);

    register_rest_route('myapp/v1', '/cart/get', [
        'methods'             => 'GET',
        'callback'            => 'myapp_get_cart_endpoint',
        'permission_callback' => '__return_true',
    ]);
});
