<?php
/**
 * Compatibility class
 *
 * This class is responsible for providing compatibility with
 * WooCommerce Germanized Pro (https://vendidero.de/woocommerce-germanized)
 *
 * @package Extra Product Options/Compatibility
 * @version 4.9
 */

defined( 'ABSPATH' ) || exit;

final class THEMECOMPLETE_EPO_CP_germanized {

	/**
	 * The single instance of the class
	 *
	 * @since 1.0
	 */
	protected static $_instance = NULL;

	/**
	 * Ensures only one instance of the class is loaded or can be loaded.
	 *
	 * @since 1.0
	 * @static
	 */
	public static function instance() {
		if ( is_null( self::$_instance ) ) {
			self::$_instance = new self();
		}

		return self::$_instance;
	}

	/**
	 * Class Constructor
	 *
	 * @since 1.0
	 */
	public function __construct() {
		add_action( 'wc_epo_add_compatibility', array( $this, 'add_compatibility' ) );
	}

	/**
	 * Add compatibility hooks and filters
	 *
	 * @since 1.0
	 */
	public function add_compatibility() {
		add_action( 'woocommerce_gzdp_invoice_item_meta_start', array( $this, 'woocommerce_gzdp_invoice_item_meta_start' ), 10, 3 );
	}

	public function woocommerce_gzdp_invoice_item_meta_start( $item_id, $item, $order ) {

		$items = $order->get_items();

		if ( function_exists( 'wc_display_item_meta' ) && isset ( $items[ $item_id ] ) ) {

			$item = $items[ $item_id ];
			echo '<br />';
			wc_display_item_meta( $item, array(
				'before'    => '',
				'after'     => '',
				'separator' => '',
				'echo'      => TRUE,
				'autop'     => FALSE,
			) );

		}
	}

}
