<?php
/**
 * The base configuration for WordPress
 *
 * The wp-config.php creation script uses this file during the
 * installation. You don't have to use the web site, you can
 * copy this file to "wp-config.php" and fill in the values.
 *
 * This file contains the following configurations:
 *
 * * MySQL settings
 * * Secret keys
 * * Database table prefix
 * * ABSPATH
 *
 * @link https://codex.wordpress.org/Editing_wp-config.php
 *
 * @package WordPress
 */

// ** MySQL settings - You can get this info from your web host ** //
/** The name of the database for WordPress */
define( 'DB_NAME', 'infinito' );

/** MySQL database username */
define( 'DB_USER', 'itodesi' );

/** MySQL database password */
define( 'DB_PASSWORD', 'itodesi@#$432' );

/** MySQL hostname */
define( 'DB_HOST', 'mysql.itodesi.com' );

/** Database Charset to use in creating database tables. */
define( 'DB_CHARSET', 'utf8mb4' );

/** The Database Collate type. Don't change this if in doubt. */
define( 'DB_COLLATE', '' );

/**#@+
 * Authentication Unique Keys and Salts.
 *
 * Change these to different unique phrases!
 * You can generate these using the {@link https://api.wordpress.org/secret-key/1.1/salt/ WordPress.org secret-key service}
 * You can change these at any point in time to invalidate all existing cookies. This will force all users to have to log in again.
 *
 * @since 2.6.0
 */
define( 'AUTH_KEY',         '}EA--0~}>G1Jm^`fp0??l3p:L:=a|oRUB&uuz?}J^,}fMYtd3LD1KhT}I6Cc/RJh' );
define( 'SECURE_AUTH_KEY',  'YW?<Ve=J)TZn?,cDG> a!b89f.)wWd#|s>+^|13]EJU(z5p+~1r-%3}|.EDW8]$L' );
define( 'LOGGED_IN_KEY',    'Ny*PE~5 e^c>b2<DEfP%N$<3o68?rlHm%EEe*]nrR%b,#aDwsu&1k2FBuHgnfUh9' );
define( 'NONCE_KEY',        '_`4:pZyR/)CzJy7rW6^OxG+_Ls@Q5169]lwp 5BF0`%D_hH~;L5m:e1WP)8Hb57-' );
define( 'AUTH_SALT',        'qRqVjFda1SMk-S+z#%H:P(K-*,%dW-/tj+eH]3&:yJHwdyEa{<w$Tx9u1B5</=(8' );
define( 'SECURE_AUTH_SALT', 'G02~Ut!$;VC:3Y0jDXXl#KDU)s.i]b51$*3ku1lkp.5fYJ(s-]z7/inFUJ`5ehn4' );
define( 'LOGGED_IN_SALT',   'B855T^sSv|f<969]P}-5Y0)%$WX^)TPdT@0N^[p]9C4PsDKMVxrT,tGTWXX ,eX@' );
define( 'NONCE_SALT',       'R 99NAx9#fjfGq^dLpmE@opIUg_nmhm%k]6jy:8W{{1>z;5WuvA6.q{rU.WlX8_@' );

/**#@-*/

/**
 * WordPress Database Table prefix.
 *
 * You can have multiple installations in one database if you give each
 * a unique prefix. Only numbers, letters, and underscores please!
 */
$table_prefix = 'wp_';

/**
 * For developers: WordPress debugging mode.
 *
 * Change this to true to enable the display of notices during development.
 * It is strongly recommended that plugin and theme developers use WP_DEBUG
 * in their development environments.
 *
 * For information on other constants that can be used for debugging,
 * visit the Codex.
 *
 * @link https://codex.wordpress.org/Debugging_in_WordPress
 */
define( 'WP_DEBUG', false );

/* That's all, stop editing! Happy publishing. */

/** Absolute path to the WordPress directory. */
if ( ! defined( 'ABSPATH' ) ) {
	define( 'ABSPATH', dirname( __FILE__ ) . '/' );
}

/** Sets up WordPress vars and included files. */
require_once( ABSPATH . 'wp-settings.php' );
