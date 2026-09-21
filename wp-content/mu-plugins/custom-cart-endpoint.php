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
 * REST Callback: Retrieve user auth methods (Google vs Password).
 * GET /wp-json/myapp/v1/user/auth-methods
 *
 * @param WP_REST_Request $request
 * @return WP_REST_Response
 */
function myapp_get_user_auth_methods_endpoint(WP_REST_Request $request) {
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

    $has_google = get_user_meta($user_id, '_myapp_has_google', true);
    $has_password_meta = get_user_meta($user_id, '_myapp_has_password', true);

    // If has_password_meta is explicitly '0', they are a Google-only user without custom password.
    // Otherwise, if not set, check if user was created before Google OAuth integration or has standard registration.
    $has_password = ($has_password_meta === '1') || ($has_password_meta === '' && $has_google !== '1');
    $is_google_active = ($has_google === '1');

    $methods = [];
    if ($has_password) {
        $methods[] = 'password';
    }
    if ($is_google_active) {
        $methods[] = 'google';
    }
    if (empty($methods)) {
        $methods[] = 'password';
    }

    $saved_avatar = get_user_meta($user_id, '_myapp_avatar_url', true);

    return new WP_REST_Response([
        'success'      => true,
        'has_password' => $has_password,
        'has_google'   => $is_google_active,
        'auth_methods' => $methods,
        'avatar_url'   => $saved_avatar ?: null,
    ], 200);
}

/**
 * Hook: Simple JWT Login OAuth authentication success.
 * Detects cross-method linking and sends a security notice on first Google sign-in for existing password accounts.
 */
function myapp_handle_oauth_success($user, $provider = 'google') {
    if (is_numeric($user)) {
        $user = get_userdata((int) $user);
    }
    if (!$user || !($user instanceof WP_User)) {
        return;
    }

    $user_id = $user->ID;
    $has_google = get_user_meta($user_id, '_myapp_has_google', true);
    $has_password = get_user_meta($user_id, '_myapp_has_password', true);

    if ($has_google !== '1') {
        update_user_meta($user_id, '_myapp_has_google', '1');

        // Link past guest orders matching user email to this customer
        if (function_exists('wc_update_new_customer_past_orders')) {
            wc_update_new_customer_past_orders($user_id);
        }

        // Check if account previously had a password (existing password account)
        if ($has_password === '1' || ($has_password === '' && !empty($user->user_pass))) {
            // Send one-time notification email
            $to = $user->user_email;
            $site_name = get_bloginfo('name');
            $subject = sprintf('[%s] A Google sign-in was linked to your account', $site_name);
            $message = sprintf(
                "Hello %s,\n\n" .
                "A Google sign-in method (%s) was just successfully linked to your account on %s.\n\n" .
                "You can now sign in using either your existing password or Google.\n\n" .
                "If you did not perform this action, please reset your password immediately or contact our support.\n\n" .
                "Best regards,\n%s Team",
                $user->display_name ?: $user->user_login,
                $user->user_email,
                $site_name,
                $site_name
            );

            wp_mail($to, $subject, $message);
        }
    } else {
        // Also ensure orders are linked on subsequent logins
        if (function_exists('wc_update_new_customer_past_orders')) {
            wc_update_new_customer_past_orders($user_id);
        }
    }
}

/**
 * REST Callback: Explicitly mark/record provider authentication for a user and sync profile details.
 * POST /wp-json/myapp/v1/user/mark-provider
 *
 * @param WP_REST_Request $request
 * @return WP_REST_Response
 */
function myapp_mark_provider_auth_endpoint(WP_REST_Request $request) {
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

    $provider = sanitize_text_field((string) ($request->get_param('provider') ?: 'google'));
    if ($provider === 'google') {
        myapp_handle_oauth_success($user, 'google');
    }

    // Automatically link past guest orders to customer ID
    if (function_exists('wc_update_new_customer_past_orders')) {
        wc_update_new_customer_past_orders($user_id);
    }

    // Update user profile fields if sent (e.g. from Google login)
    $first_name   = sanitize_text_field((string) ($request->get_param('first_name') ?: ''));
    $last_name    = sanitize_text_field((string) ($request->get_param('last_name') ?: ''));
    $display_name = sanitize_text_field((string) ($request->get_param('display_name') ?: ''));
    $avatar_url   = esc_url_raw((string) ($request->get_param('avatar_url') ?: ''));

    $userdata_update = ['ID' => $user_id];
    $needs_update = false;

    if (!empty($first_name)) {
        $userdata_update['first_name'] = $first_name;
        update_user_meta($user_id, 'first_name', $first_name);
        $needs_update = true;
    }
    if (!empty($last_name)) {
        $userdata_update['last_name'] = $last_name;
        update_user_meta($user_id, 'last_name', $last_name);
        $needs_update = true;
    }
    if (!empty($display_name)) {
        $userdata_update['display_name'] = $display_name;
        $userdata_update['nickname'] = $display_name;
        $needs_update = true;
    } elseif ($needs_update) {
        $fullName = trim(($first_name ?: $user->first_name) . ' ' . ($last_name ?: $user->last_name));
        if (!empty($fullName)) {
            $userdata_update['display_name'] = $fullName;
            $userdata_update['nickname'] = $fullName;
        }
    }

    if ($needs_update) {
        wp_update_user($userdata_update);
    }

    if (!empty($avatar_url)) {
        update_user_meta($user_id, '_myapp_avatar_url', $avatar_url);
    }

    $has_google = get_user_meta($user_id, '_myapp_has_google', true);
    $has_password_meta = get_user_meta($user_id, '_myapp_has_password', true);
    $has_password = ($has_password_meta === '1') || ($has_password_meta === '' && $has_google !== '1');
    $saved_avatar = get_user_meta($user_id, '_myapp_avatar_url', true);

    return new WP_REST_Response([
        'success'      => true,
        'has_password' => $has_password,
        'has_google'   => ($has_google === '1'),
        'avatar_url'   => $saved_avatar ?: null,
    ], 200);
}

// Hook into Simple JWT Login token generation
add_filter('simple_jwt_login_generate_payload', function ($payload, $user) {
    if (
        (isset($_REQUEST['provider']) && $_REQUEST['provider'] === 'google') ||
        (isset($_GET['provider']) && $_GET['provider'] === 'google')
    ) {
        myapp_handle_oauth_success($user, 'google');
    }
    return $payload;
}, 10, 2);

add_action('simple_jwt_login_oauth_auth_success', 'myapp_handle_oauth_success', 10, 2);
add_action('simple_jwt_login_after_authenticate', function ($user, $request = null) {
    if (isset($_GET['provider']) && $_GET['provider'] === 'google') {
        myapp_handle_oauth_success($user, 'google');
    }
}, 10, 2);

/**
 * Hook: Track password creation on registration and link past guest orders.
 */
add_action('user_register', function ($user_id) {
    // If not creating via OAuth provider
    if (!isset($_GET['provider'])) {
        update_user_meta($user_id, '_myapp_has_password', '1');
    } else {
        update_user_meta($user_id, '_myapp_has_google', '1');
        update_user_meta($user_id, '_myapp_has_password', '0');
    }

    if (function_exists('wc_update_new_customer_past_orders')) {
        wc_update_new_customer_past_orders($user_id);
    }
}, 10, 1);

add_action('woocommerce_created_customer', function ($customer_id) {
    if (function_exists('wc_update_new_customer_past_orders')) {
        wc_update_new_customer_past_orders($customer_id);
    }
}, 10, 1);

/**
 * Hook: Track password reset / update.
 */
add_action('password_reset', function ($user) {
    if ($user && isset($user->ID)) {
        update_user_meta($user->ID, '_myapp_has_password', '1');
    }
}, 10, 1);

/**
 * Register custom persistent cart and auth REST routes.
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

    register_rest_route('myapp/v1', '/user/auth-methods', [
        'methods'             => 'GET',
        'callback'            => 'myapp_get_user_auth_methods_endpoint',
        'permission_callback' => '__return_true',
    ]);

    register_rest_route('myapp/v1', '/user/mark-provider', [
        'methods'             => 'POST',
        'callback'            => 'myapp_mark_provider_auth_endpoint',
        'permission_callback' => '__return_true',
    ]);
});
