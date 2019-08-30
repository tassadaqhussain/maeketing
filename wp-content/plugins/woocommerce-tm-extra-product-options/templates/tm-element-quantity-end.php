<?php
/**
 * The template for displaying the end of the quantity selector of an option
 *
 * This template can be overridden by copying it to yourtheme/tm-extra-product-options/tm-element-quantity-end.php
 *
 * NOTE that we may need to update template files and you
 * (the plugin or theme developer) will need to copy the new files
 * to your theme or plugin to maintain compatibility.
 *
 * @author  themeComplete
 * @package WooCommerce Extra Product Options/Templates
 * @version 4.9
 */

defined( 'ABSPATH' ) || exit;

if ( ! empty( $quantity ) ) {

	echo '</div>';

	if ( isset( $tm_element_settings ) && ! empty( $quantity ) && strtolower( $quantity ) == "bottom" ) {?>
	<div class="tm-quantity tm-<?php echo esc_attr( $quantity ); ?>">
		<?php do_action( 'wc_epo_quantity_selector_before_input', isset( $tm_element_settings ) ? $tm_element_settings : array() ); ?>
		<input type="number" step="<?php echo esc_attr( $__step ); ?>" 
		<?php 
		if ( is_numeric( $__min_value ) ){
			echo ' min="' . esc_attr( $__min_value ) . '"';
		}
		if ( is_numeric( $__max_value ) ){
			echo ' min="' . esc_attr( $__max_value ) . '"';
		}
		?> name="<?php echo esc_attr( $name ); ?>_quantity" value="<?php echo esc_attr( $__default_value ); ?>" 
		title="<?php echo esc_attr_x( 'Qty', 'element quantity input tooltip', 'woocommerce-tm-extra-product-options' ); ?>" 
		class="tm-qty tm-bsbb" size="4" /> 
		<?php do_action( 'wc_epo_quantity_selector_after_input', isset( $tm_element_settings ) ? $tm_element_settings : array() ); ?>
	</div>	
	<?php
	}

}