(function (window, document, $) {
    "use strict";

    var wp = window.wp;
    var TMEPOADMINJS = window.TMEPOADMINJS;
    var TMEPOGLOBALADMINJS = window.TMEPOGLOBALADMINJS;
    var confirm = window.confirm;
    var woocommerce_admin;
    var tinyMCEPreInit;
    var QTags;
    var quicktags;
    var tinyMCE;
    var toastr = window.toastr;
    var _ = window._;
    var plupload = window.plupload;
    var globalVariationObject = false;
    var templateEngine = {
        "tc_builder_elements": wp.template("tc-builder-elements"),
        "tc_builder_section": wp.template("tc-builder-section")
    };
    var JSON = window.JSON;

    templateEngine = $.epoAPI.applyFilter("tc_adjust_admin_template_engine", templateEngine);

    // https://github.com/kvz/phpjs/blob/master/functions/array/array_values.js 
    if (!$.tm_array_values) {
        $.tm_array_values = function (input) {
            var tmp_arr = [];
            Object.keys(input).forEach(function (key) {
                if (input.hasOwnProperty(key)) {
                    tmp_arr[tmp_arr.length] = input[key];
                }
            });
            return tmp_arr;
        };
    }

    // https://github.com/kvz/phpjs/blob/master/functions/misc/uniqid.js 
    if (!$.tm_uniqid) {
        $.tm_uniqid = function (prefix, more_entropy) {

            var retId;
            var formatSeed = function (seed, reqWidth) {
                seed = parseInt(seed, 10).toString(16); // to hex str
                if (reqWidth < seed.length) {
                    // so long we split
                    return seed.slice(seed.length - reqWidth);
                }
                if (reqWidth > seed.length) {
                    // so short we pad
                    return Array(1 + (reqWidth - seed.length)).join("0") + seed;
                }
                return seed;
            };
            var calc;

            if (typeof prefix === "undefined") {
                prefix = "";
            }
            // BEGIN REDUNDANT
            if (!this.php_js) {
                this.php_js = {};
            }
            // END REDUNDANT
            if (!this.php_js.uniqidSeed) {
                // init seed with big random int
                this.php_js.uniqidSeed = Math.floor(Math.random() * 0x75bcd15);
            }
            this.php_js.uniqidSeed += 1;

            // start with prefix, add current milliseconds hex string
            retId = prefix;
            retId += formatSeed(parseInt(new Date().getTime() / 1000, 10), 8);
            // add seed hex string
            retId += formatSeed(this.php_js.uniqidSeed, 5);
            if (more_entropy) {
                // for more entropy we add a float lower to 10
                calc = (Math.random() * 10);
                retId += calc.toFixed(8).toString();
            }

            return retId;

        };
    }

    $.tmEPOAdmin = {

        "add_events_done": 0,

        add_sortables: function () {

            if ($.tmEPOAdmin.is_original) {
                // Sections sortable
                $(".builder_layout").sortable({
                    "handle": ".move",
                    "cursor": "move",
                    "items": ".builder_wrapper:not(.tma-nomove)",
                    "start": function (e, ui) {
                        ui.placeholder.height(ui.helper.outerHeight());
                        ui.placeholder.width(ui.helper.outerWidth());
                    },
                    "stop": function () {
                        $.tmEPOAdmin.builder_reorder_multiple();
                    },
                    "cancel": ".tma-nomove",
                    "forcePlaceholderSize": true,
                    "placeholder": "bitem pl2",

                    "forceHelperSize": true,
                    "helper": "clone",

                    "tolerance": "pointer"
                });

                // Elements sortable
                $.tmEPOAdmin.builder_items_sortable($(".builder_wrapper .bitem_wrapper"));

                // Elements draggable
                $(".builder_elements .ditem").draggable({
                    "zIndex": 5000,
                    "scroll": true,
                    "helper": "clone",
                    "start": function (event) {
                        var current = $(event.target);
                        current.css({
                            opacity: 0.3
                        });
                        $(".builder_layout .bitem_wrapper").not(".tma-variations-wrap .bitem_wrapper").addClass("highlight");
                    },
                    "stop": function (event) {
                        $(".builder_layout .bitem_wrapper").removeClass("highlight");
                        $(event.target).css({
                            opacity: 1
                        });
                    },
                    "connectToSortable": ".builder_layout .bitem_wrapper:not(.tma-nomove .bitem_wrapper)"
                });
            }

        },

        add_events: function () {

            var $waiting;
            var tcuploader;
            var popup;
            var uploadmeta;

            if ($.tmEPOAdmin.add_events_done === 1) {
                return;
            }

            $.tmEPOAdmin.add_sortables();

            // Import CSV
            $waiting = $("#builder_import_file");

            tcuploader = new plupload.Uploader({
                "url": TMEPOGLOBALADMINJS.import_url,
                "browse_button": $waiting[0],
                "file_data_name": "builder_import_file",
                "multi_selection": false
            });

            tcuploader.init();

            tcuploader.bind("FilesAdded", function (uploader) {
                var $_html = $.tmEPOAdmin.builder_floatbox_template_import({
                    "id": "temp_for_floatbox_insert",
                    "html": "",
                    "title": TMEPOGLOBALADMINJS.i18n_import_title
                });
                var $progress;
                var $selection;

                popup = $.tcFloatBox({
                    "closefadeouttime": 0,
                    "animateOut": "",
                    "fps": 1,
                    "ismodal": true,
                    "refresh": "fixed",
                    "width": "50%",
                    "height": "300px",
                    "classname": "flasho tm_wrapper",
                    "data": $_html
                });

                $progress = $("<div class=\"tm_progress_bar tm_orange\"><span class=\"tm_percent\"></span></div><div class=\"tm_progress_info\"><span class=\"tm_info\"></span></div>");
                $selection = $("<div class=\"override-selection\"><button type=\"button\" class=\"tc tc-button details_override\">" + TMEPOGLOBALADMINJS.i18n_overwrite_existing_elements + "</button><button type=\"button\" class=\"tc tc-button details_append\">" + TMEPOGLOBALADMINJS.i18n_append_new_elements + "</button></div>");
                $selection.appendTo("#temp_for_floatbox_insert");

                uploadmeta = $.tmEPOAdmin.tm_escape(JSON.stringify($.tmEPOAdmin.prepare_for_json($("#tmformfieldsbuilderwrap").tcSerializeObject())));

                if (TMEPOGLOBALADMINJS.is_original_post) {

                    $(".details_override").on("click", function () {
                        $("#temp_for_floatbox_insert").find(".override-selection").remove();
                        $progress.appendTo("#temp_for_floatbox_insert");
                        $(".tm_info").html(TMEPOGLOBALADMINJS.i18n_importing);
                        uploader.setOption("multipart_params", {
                            "action": "import",
                            "import_override": 1,
                            "post_id": TMEPOGLOBALADMINJS.post_id,
                            "tm_uploadmeta": uploadmeta,
                            security: TMEPOGLOBALADMINJS.import_nonce,
                            "is_original_post": TMEPOGLOBALADMINJS.is_original_post
                        });
                        uploader.start();
                        $(".flasho").addClass("tm_color_orange");
                    });

                    $(".details_append").on("click", function () {
                        $("#temp_for_floatbox_insert").find(".override-selection").remove();
                        $progress.appendTo("#temp_for_floatbox_insert");
                        $(".tm_info").html(TMEPOGLOBALADMINJS.i18n_importing);
                        uploader.setOption("multipart_params", {
                            "action": "import",
                            "import_override": 0,
                            "post_id": TMEPOGLOBALADMINJS.post_id,
                            "tm_uploadmeta": uploadmeta,
                            security: TMEPOGLOBALADMINJS.import_nonce,
                            "is_original_post": TMEPOGLOBALADMINJS.is_original_post
                        });
                        uploader.start();
                        $(".flasho").addClass("tm_color_orange");
                    });

                } else {
                    $("#temp_for_floatbox_insert").find(".override-selection").remove();
                    $progress.appendTo("#temp_for_floatbox_insert");
                    $(".tm_info").html(TMEPOGLOBALADMINJS.i18n_importing);
                    uploader.setOption("multipart_params", {
                        "action": "import",
                        "import_override": 1,
                        "post_id": TMEPOGLOBALADMINJS.post_id,
                        "tm_uploadmeta": uploadmeta,
                        security: TMEPOGLOBALADMINJS.import_nonce,
                        "is_original_post": TMEPOGLOBALADMINJS.is_original_post
                    });
                    uploader.start();
                    $(".flasho").addClass("tm_color_orange");
                }

            });

            tcuploader.bind("FileUploaded", function (uploader, file, response) {
                var data = $.epoAPI.util.parseJSON(response.response);
                if (data && "result" in data && data.message) {
                    $(".tm_info").html(data.message);
                }
                if (data && data.error && data.message) {
                    $(".tm_info").html(data.message);
                }
                if (data && "result" in data && $.epoAPI.math.toFloat(data.result) === 1) {
                    $(".tm_progress_bar").removeClass("tm_orange").addClass("tm_turquoise");
                    $(".tm_info").removeClass("tm_color_pomegranate").addClass("tm_color_turquoise");
                    $(".flasho").removeClass("tm_color_orange tm_color_pomegranate").addClass("tm_color_turquoise");
                    $(".floatbox-cancel").remove();
                    $(".tm_info").html(TMEPOGLOBALADMINJS.i18n_saving);
                    $(window).off("beforeunload.edit-post");
                    if (data.options) {
                        $(".builder_layout").html(data.options);
                        $.tmEPOAdmin.setGlobalVariationObject("initialitize_on_after");
                        toastr.success(data.message, TMEPOGLOBALADMINJS.i18n_epo);
                    }
                    popup.destroy();
                } else {
                    $(".tm_progress_bar").removeClass("tm_orange").addClass("tm_pomegranate");
                    $(".tm_info").removeClass("tm_color_turquoise").addClass("tm_color_pomegranate");
                    $(".flasho").removeClass("tm_color_orange tm_color_turquoise").addClass("tm_color_pomegranate");
                }

            });

            tcuploader.bind("UploadProgress", function (uploader, file) {
                var progress = parseInt(file.percent, 10);
                $(".tm_progress_bar").css("width", progress + "%");
                $(".tm_percent").html(progress + "%");

            });

            tcuploader.bind("Error", function (uploader, error) {
                if (error && error.message) {
                    $(".tm_info").removeClass("tm_color_turquoise").addClass("tm_color_pomegranate").html("\nError #" + error.code + ": " + error.message);
                }
                $(".tm_progress_bar").removeClass("tm_orange").addClass("tm_pomegranate");
                $(".flasho").removeClass("tm_color_orange tm_color_turquoise").addClass("tm_color_pomegranate");
            });

            tcuploader.bind("UploadComplete", function () {
                $("body").removeClass("overflow");
            });

            // Export button
            $(document).on("click.cpf", "#builder_export", function (e) {

                var $this = $(this);
                var tm_meta;
                var data;
                var tcForm = $("#tmformfieldsbuilderwrap");

                e.preventDefault();

                if ($this.data("doing_export")) {
                    return;
                }

                $this.data("doing_export", 1).prepend("<i class=\"tm-icon tcfa tcfa-refresh tcfa-spin\"></i>");

                tm_meta = $.tmEPOAdmin.prepare_for_json(tcForm.tcSerializeObject());

                tm_meta = JSON.stringify(tm_meta);

                data = {
                    "action": "tm_export",
                    "metaserialized": tm_meta,
                    "is_original_post": TMEPOGLOBALADMINJS.is_original_post,
                    "security": TMEPOGLOBALADMINJS.export_nonce
                };

                $.post(TMEPOGLOBALADMINJS.ajax_url, data, function (response) {

                    var $_html;

                    if (response && response.result && response.result !== "") {
                        window.location = response.result;
                    } else {
                        if (response && response.error && response.message) {
                            $_html = $.tmEPOAdmin.builder_floatbox_template_import({
                                "id": "temp_for_floatbox_insert",
                                "html": "<div class=\"tm-inner\">" + response.message + "</div>",
                                "title": TMEPOGLOBALADMINJS.i18n_error_title
                            });
                            $.tcFloatBox({
                                "closefadeouttime": 0,
                                "animateOut": "",
                                "fps": 1,
                                "ismodal": true,
                                "refresh": "fixed",
                                "width": "50%",
                                "height": "300px",
                                "classname": "flasho tm_wrapper tm-error",
                                "data": $_html
                            });
                        }
                    }

                }, "json")
                .always(function () {
                    $this.data("doing_export", 0).find(".tm-icon").remove();
                });
            });

            // Save button
            $(document).on("click.cpf", "#builder_save", function (e) {
                var data;
                var $this = $(this);

                if ($this.data("doing_export")) {
                    return;
                }

                $this.data("doing_export", 1).prepend("<i class=\"tm-icon tcfa tcfa-refresh tcfa-spin\"></i>");

                data = {
                    "action": "tm_save",
                    "tm_uploadmeta": $.tmEPOAdmin.tm_escape(JSON.stringify($.tmEPOAdmin.prepare_for_json($("#tmformfieldsbuilderwrap").tcSerializeObject()))),
                    "post_id": TMEPOGLOBALADMINJS.post_id,
                    "security": TMEPOGLOBALADMINJS.save_nonce
                };

                $("#tmformfieldsbuilderwrap").addClass("disabled");

                e.preventDefault();
                $.post(TMEPOGLOBALADMINJS.ajax_url, data, function (response) {

                    if (response && response.result && response.result === 1) {
                        toastr.success(response.message, TMEPOGLOBALADMINJS.i18n_epo);
                    } else {
                        toastr.error(response.message, TMEPOGLOBALADMINJS.i18n_epo);
                    }

                }, "json")
                .always(function (response) {
                    $("#tmformfieldsbuilderwrap").removeClass("disabled");
                    if (response.responseText === "-1") {
                        toastr.error(TMEPOGLOBALADMINJS.i18n_invalid_request, TMEPOGLOBALADMINJS.i18n_epo);
                    }
                    $this.data("doing_export", 0).find(".tm-icon").remove();
                });
            });

            $(document).on("click.cpf", "#builder_import,.tc-add-import-csv", function (e) {
                e.preventDefault();
                $("#builder_import_file").trigger("click");
            });

            // Fullsize button
            $(document).on("click.cpf", "#builder_fullsize", function (e) {

                e.preventDefault();
                $("body").addClass("overflow fullsize");

            });

            // Close Fullsize button
            $(document).on("click.cpf", "#builder_fullsize_close", function (e) {

                e.preventDefault();
                $("body").removeClass("overflow fullsize");

            });

            // Add Element button
            $(document).on("click.cpf", ".builder-add-element", $.tmEPOAdmin.builder_add_element_onClick);
            // Section add button
            $(document).on("click.cpf", ".builder_add_section,.tc-add-section ", $.tmEPOAdmin.builder_add_section_onClick);
            $(document).on("click.cpf", ".builder-add-section-and-element,.tc-add-element", $.tmEPOAdmin.builder_add_section_and_element_onClick);
            // Variation button
            $(document).on("click.cpf", ".builder_add_variation", $.tmEPOAdmin.builder_add_variation_onClick);

            // Section edit button
            $(document).on("click.cpf", ".builder_wrapper .btitle .edit", $.tmEPOAdmin.builder_section_item_onClick);
            // Section clone button
            $(document).on("click.cpf", ".builder_wrapper .btitle .clone", $.tmEPOAdmin.builder_section_clone_onClick);
            // Section plus button
            $(document).on("click.cpf", ".builder_wrapper .btitle .plus", $.tmEPOAdmin.builder_section_plus_onClick);
            // Section minus button
            $(document).on("click.cpf", ".builder_wrapper .btitle .minus", $.tmEPOAdmin.builder_section_minus_onClick);
            // Section delete button
            $(document).on("click.cpf", ".builder_wrapper .btitle .delete:not(.builder_wrapper.tma-variations-wrap .btitle .delete)", $.tmEPOAdmin.builder_section_delete_onClick);
            // Section fold button
            $(document).on("click.cpf", ".builder_wrapper .btitle .fold", $.tmEPOAdmin.builder_section_fold_onClick);

            // Variation delete button
            $(document).on("click", ".builder_wrapper.tma-variations-wrap .btitle .delete", $.tmEPOAdmin.builder_variation_delete_onClick);

            // Element edit button
            $(document).on("click.cpf", ".bitem .edit", $.tmEPOAdmin.builder_item_onClick);
            // Element clone button
            $(document).on("click.cpf", ".bitem .clone", $.tmEPOAdmin.builder_clone_onClick);
            // Element plus button
            $(document).on("click.cpf", ".bitem .plus", $.tmEPOAdmin.builder_plus_onClick);
            // Element minus button
            $(document).on("click.cpf", ".bitem .minus", $.tmEPOAdmin.builder_minus_onClick);
            // Element delete button
            $(document).on("click", ".bitem .delete", $.tmEPOAdmin.builder_delete_onClick);

            // Add options button
            $(document).on("click.cpf", ".builder-panel-add", $.tmEPOAdmin.builder_panel_add_onClick);
            // Mass add options button
            $(document).on("click.cpf", ".builder-panel-mass-add", $.tmEPOAdmin.builder_panel_mass_add_onClick);
            // Populate options button
            $(document).on("click.cpf", ".builder-panel-populate", $.tmEPOAdmin.builder_panel_populate_onClick);
            // Remove image
            $(document).on("click.cpf", ".builder-image-delete", $.tmEPOAdmin.builder_image_delete_onClick);
            // Delete options button
            $(document).on("click.cpf", ".builder_panel_delete", $.tmEPOAdmin.builder_panel_delete_onClick);
            $(".builder_panel_delete").on("click.cpf", $.tmEPOAdmin.builder_panel_delete_onClick); //sortable bug
            $(document).on("click.cpf", ".builder_panel_delete_all", $.tmEPOAdmin.builder_panel_delete_all_onClick);
            $(document).on("click.cpf", ".builder_panel_up", function () {

                var t = $(this);
                var options_wrap = t.closest(".options_wrap");
                var prev = options_wrap.prev();

                prev.before(options_wrap);
                $.tmEPOAdmin.panels_reorder(t.closest(".panels_wrap"));
                $.tmEPOAdmin.paginattion_init("current");

            });
            $(document).on("click.cpf", ".builder_panel_down", function () {

                var t = $(this);
                var options_wrap = t.closest(".options_wrap");
                var next = options_wrap.next();

                next.after(options_wrap);
                $.tmEPOAdmin.panels_reorder(t.closest(".panels_wrap"));
                $.tmEPOAdmin.paginattion_init("current");

            });

            // Auto generate option value
            $(document).on("keyup.cpf change.cpf", ".tm_option_title", function () {
                $(this).closest(".options_wrap").find(".tm_option_value").val($(this).val());
            });
            // Upload button
            $(document).on("click.cpf", ".tm_upload_button", $.tmEPOAdmin.upload);
            $(document).on("change.cpf", ".use_images,.tm-use-lightbox,.use_colors", $.tmEPOAdmin.tm_upload);
            $(document).on("change.cpf", ".use_url", $.tmEPOAdmin.tm_url);

            $(document).on("change.cpf", ".tm-qty-selector", $.tmEPOAdmin.tm_qty_selector);
            $(document).on("change.cpf", ".tm-pricetype-selector", $.tmEPOAdmin.tm_pricetype_selector);

            $(document).on("change.cpf", ".variations-display-as", $.tmEPOAdmin.variations_display_as);
            $(document).on("change.cpf", ".tm-attribute .tm-changes-product-image", $.tmEPOAdmin.variations_display_as);
            $(document).on("click.cpf", ".tm-upload-button-remove", $.tmEPOAdmin.tm_upload_button_remove_onClick);

            $(document).on("change.cpf", ".tm-weekday-picker", $.tmEPOAdmin.tm_weekday_picker);

            $(document).on("click.cpf", ".tm-tags-container .tab-header", function () {

                var $this = $(this);
                var tm_tags_container = $this.closest(".tm-tags-container");
                var tm_elements_container = tm_tags_container.find(".tm-elements-container");
                var elements = tm_elements_container.find("li.tm-element-button");
                var headers = tm_tags_container.find(".tab-header");
                var tag_to_show = $this.attr("data-tm-tag");

                headers.removeClass("open").addClass("closed");
                $this.removeClass("closed").addClass("open");

                if (tag_to_show === "all") {
                    elements.removeClass("tm-hidden");
                } else {
                    elements.addClass("tm-hidden");
                    elements.filter("." + tag_to_show).removeClass("tm-hidden");
                }

            });

            // popup editor identification
            $(document).on("click.cpf", ".tm_editor_wrap", function () {

                var t = $(this).find("textarea");

                if (t.attr("id")) {
                    window.wpActiveEditor = t.attr("id");
                }

            });

            $(document).on("change.cpf", ".cpf-logic-element", $.tmEPOAdmin.cpf_logic_element_onchange);
            $(document).on("change.cpf", ".cpf-logic-operator", $.tmEPOAdmin.cpf_logic_operator_onchange);

            $(document).on("change.cpf", ".activate-sections-logic, .activate-element-logic", function () {

                var value = parseInt($(this).val(), 10);

                if (value === 1) {
                    $(this).parent().find(".builder-logic-div").show();
                } else {
                    $(this).parent().find(".builder-logic-div").hide();
                }

            });
            $(document).on("dblclick.cpf", ".tm-default-radio", function () {
                $(this).removeAttr("checked").prop("checked", false);
            });

            $(document).on("click", ".tm-element-label,.tm-internal-label", function () {

                var t = $(this);

                $.tmEPOAdmin.current_edit_label = t;
                t.addClass("tm-hidden").closest(".tm-label-desc").addClass("tm-hidden").next(".tm-label-desc-edit").removeClass("tm-hidden").find(".tm-internal-name").focus();

            });
            $(document).mouseup(function (e) {

                var container = $.tmEPOAdmin.current_edit_label;
                var input;

                if (!$.tmEPOAdmin.current_edit_label) {
                    return;
                }

                // if the target of the click isn't the container...
                // ... nor a descendant of the container
                if (!container.is(e.target) && container.has(e.target).length === 0 && !$(e.target).is(".tm-internal-name")) {
                    input = container.closest(".tm-label-desc").next(".tm-label-desc-edit").find(".tm-internal-name");
                    input.trigger("change");

                    if (container.is(".tm-internal-label")) {
                        container.html(input.val()).removeClass("tm-hidden");
                    }
                    if (container.is(".tm-element-label")) {
                        container.removeClass("tm-hidden").closest(".tm-label-desc").find(".tm-internal-label").html(input.val());
                    }

                    container.closest(".tm-label-desc").removeClass("tm-hidden").next(".tm-label-desc-edit").addClass("tm-hidden");

                    if (input.val() === "") {
                        container.closest(".tm-label-desc").removeClass("tc-has-value").addClass("tc-empty-value");
                        container.closest(".tm-label-desc").find(".tm-internal-label").html(container.closest(".tm-label-desc").find(".tm-element-label").html());
                        input.val(container.closest(".tm-label-desc").find(".tm-element-label").html());
                    } else {
                        container.closest(".tm-label-desc").removeClass("tc-empty-value").addClass("tc-has-value");
                    }
                    $.tmEPOAdmin.current_edit_label = false;
                }

            });

            $(document).on("change.cpf", ".multiple_radiobuttons_options", function () {

                var $this = $(this);
                var panels_wrap = $this.closest(".panels_wrap");

                if ($this.val() === "fee") {
                    panels_wrap.find(".multiple_radiobuttons_options").val("fee");
                } else if ($this.val() === "subscriptionfee") {
                    panels_wrap.find(".multiple_radiobuttons_options").val("subscriptionfee");
                } else {
                    panels_wrap.find(".multiple_radiobuttons_options").filter(function () {
                        return this.value === "fee" || this.value === "subscriptionfee";
                    }).val($this.val());
                }

            });

            $(document).on("change.cpf", ".tm_select_price_type", function () {

                var $this = $(this);
                var panels_wrap = $this.closest(".builder_element_wrap").find(".panels_wrap");

                if ($this.val() === "fee") {
                    panels_wrap.find(".multiple_selectbox_options").children("option[value=\"percentcurrenttotal\"]").hide();
                    panels_wrap.find(".multiple_selectbox_options").filter(function () {
                        return this.value === "percentcurrenttotal";
                    }).val("");
                } else {
                    panels_wrap.find(".multiple_selectbox_options").children("option[value=\"percentcurrenttotal\"]").show();
                }

                $.tmEPOAdmin.selectbox_price_type($this);

            });

            $(document).on("click.cpf", ".cpf-add-rule", $.tmEPOAdmin.cpf_add_rule);
            $(document).on("click.cpf", ".cpf-delete-rule", $.tmEPOAdmin.cpf_delete_rule);

            // General fold button
            $(document).on("click.cpf", ".tma-handle-wrap .tma-handle", $.tmEPOAdmin.builder_fold_onClick);

            $(document).on("keyup change", "#temp_for_floatbox_insert .n[type=text]", function () {

                var $this = $(this);
                var value = $this.val();
                var regex = new RegExp("[^-0-9%.\\" + woocommerce_admin.mon_decimal_point + "]+", "gi");
                var newvalue = value.replace(regex, "");
                var offset;

                if (value !== newvalue) {
                    $this.val(newvalue);
                    if ($this.parent().find(".wc_error_tip").length === 0) {
                        offset = $this.position();
                        $this.after("<div class=\"wc_error_tip\">" + woocommerce_admin.i18n_mon_decimal_error + "</div>");
                        $(".wc_error_tip")
                        .css("left", offset.left + $this.width() - ( $this.width() / 2 ) - ( $(".wc_error_tip").width() / 2 ))
                        .css("top", offset.top + $this.height())
                        .fadeIn("100");
                    }
                }

                return this;

            });

            $(document).on("click", ".builder_elements .tc-handle", function () {

                var $this = $(this);
                var handle_wrapper = $this.closest(".builder_elements");

                if (!$this.data("folded") && $this.data("folded") !== undefined) {
                    $this.data("folded", true);
                    $this.removeClass("tcfa-caret-down").addClass("tcfa-caret-up");
                    handle_wrapper.addClass("closed");
                } else {
                    $this.data("folded", false);
                    $this.removeClass("tcfa-caret-up").addClass("tcfa-caret-down");
                    handle_wrapper.removeClass("closed");
                }

                $.tmEPOAdmin.fix_content_float();

            });

            $(document).on("click", ".tc-enable-responsive", function () {

                var $this = $(this);
                var on = $this.find(".on");
                var off = $this.find(".off");
                var divs = $("#temp_for_floatbox_insert").find(".builder_responsive_div");

                if ($this.is(".active")) {
                    $this.removeClass("active");
                    on.addClass("tm-hidden");
                    off.removeClass("tm-hidden");
                    divs.hide();
                } else {
                    $this.addClass("active");
                    on.removeClass("tm-hidden");
                    off.addClass("tm-hidden");
                    divs.show();
                }

            });

            $(document).on("change.cpf", ".tma-variations-section .sections_style", function () {

                var $temp_for_floatbox_insert = $("#temp_for_floatbox_insert");

                $temp_for_floatbox_insert.find(".builder_hide_for_variations").hide();
                $temp_for_floatbox_insert.find(".builder_hide_for_variation").hide();

            });

            if ($().ajaxChosen) {
                $("select.ajax_chosen_select_tm_product_ids").ajaxChosen({
                    method: "GET",
                    url: TMEPOGLOBALADMINJS.ajax_url,
                    dataType: "json",
                    afterTypeDelay: 100,
                    data: {
                        action: "woocommerce_json_search_products",
                        security: TMEPOGLOBALADMINJS.search_products_nonce
                    }
                }, function (data) {

                    var terms = {};

                    $.each(data, function (i, val) {
                        terms[i] = val;
                    });

                    return terms;
                });
            }

            $("body").on("woocommerce-product-type-change", function () {

                var product_type = $("#product-type");
                var variation_element;

                $.tmEPOAdmin.init_sections_check();
                $.tmEPOAdmin.fix_content_float();

                if (product_type.length) {
                    if (!(product_type.val() === "variable" || product_type.val() === "variable-subscription")) {
                        variation_element = $(".builder_layout .element-variations");
                        if (variation_element.length) {
                            variation_element.closest(".builder_wrapper").remove();
                            $.tmEPOAdmin.builder_reorder_multiple();
                            $(".builder_layout .builder_wrapper").each(function (i, el) {
                                $.tmEPOAdmin.logic_init($(el));
                            });
                            $.tmEPOAdmin.init_sections_check();
                            $.tmEPOAdmin.fix_content_float();

                            $.tmEPOAdmin.toggle_variation_button();
                            $.tmEPOAdmin.var_remove("tm-style-variation-added");
                        }
                    }
                    $.tmEPOAdmin.toggle_variation_button();
                }

            });

            $(document).on("change.cpf", ".builder_textfield_price_type", function () {
                $.tmEPOAdmin.set_fields_change($(this));
            });
            $(document).on("changetitle.cpf", ".tm-header-title", function () {
                $.tmEPOAdmin.set_field_title($(this));
            });

            $(document).on("sections_type_onChange.cpf", ".builder_wrapper", function () {
                $.tmEPOAdmin.sections_type_onChange($(this));
            });
            $(document).on("click.cpf", ".meta-disable-categories", function () {
                $.tmEPOAdmin.disable_categories();
            });
            $(document).on("change.cpf", ".product_page_tm-global-epo #product_catdiv input:checkbox, .product_page_tm-global-epo #tm_product_ids, .product_page_tm-global-epo #tm_enabled_options, .product_page_tm-global-epo #tm_disabled_options", function () {
                $.tmEPOAdmin.check_if_applied();
            });

            $.tmEPOAdmin.add_events_done = 1;

        },

        initialitize: function () {
            $.tmEPOAdmin.setGlobalVariationObject("initialitize_on");
        },

        initialitize_on: function () {

            $.tmEPOAdmin.isinit = true;
            $.tmEPOAdmin.pre_element_logic_init_obj = {};
            $.tmEPOAdmin.pre_element_logic_init_obj_options = {};

            $.tmEPOAdmin.pre_element_logic_init(true);
            $.tmEPOAdmin.pre_element_logic_init_done = true;

            $.tmEPOAdmin.is_original = ($(".tm-wmpl-disabled").length === 0);
            $.tmEPOAdmin.current_edit_label = false;

            $.tmEPOAdmin.toggle_variation_button();

            $.tmEPOAdmin.add_events();

            // Check section logic
            $.tmEPOAdmin.check_section_logic();
            // Check element logic
            $.tmEPOAdmin.check_element_logic();
            // Start logic
            $.tmEPOAdmin.section_logic_start();
            $.tmEPOAdmin.element_logic_start();

            // Prevent refresh page changes to hidden elements
            $.tmEPOAdmin.set_hidden();

            $.tmEPOAdmin.set_fields_change();

            $.tmEPOAdmin.set_field_title();

            $(".builder_wrapper.tm-slider-wizard").each(function () {
                var bw = $(this);
                $.tmEPOAdmin.create_slider(bw);
            });

            // Move disabled categories checkbox
            $("#taxonomy-product_cat").before($("#tc_disabled_categories").removeClass("hidden"));
            $.tmEPOAdmin.disable_categories();

            $("#product_catdiv").before($("<div class=\"tc-info-box hidden\"></div>"));
            $.tmEPOAdmin.check_if_applied();

            $.tmEPOAdmin.init_sections_check();
            $.tmEPOAdmin.fix_content_float();

            $.tmEPOAdmin.fix_form_submit();

            $.tmEPOAdmin.pre_element_logic_init_done = false;
            $.tmEPOAdmin.isinit = false;

        },

        initialitize_on_after: function () {

            $.tmEPOAdmin.isinit = true;
            $.tmEPOAdmin.pre_element_logic_init_obj = {};
            $.tmEPOAdmin.pre_element_logic_init_obj_options = {};

            $.tmEPOAdmin.pre_element_logic_init(true);
            $.tmEPOAdmin.pre_element_logic_init_done = true;

            $.tmEPOAdmin.is_original = ($(".tm-wmpl-disabled").length === 0);
            $.tmEPOAdmin.current_edit_label = false;

            $.tmEPOAdmin.var_remove("tm-style-variation-added");
            $.tmEPOAdmin.toggle_variation_button();

            //$.tmEPOAdmin.add_events();
            $.tmEPOAdmin.add_sortables();

            // Check section logic
            $.tmEPOAdmin.check_section_logic();
            // Check element logic
            $.tmEPOAdmin.check_element_logic();
            // Start logic
            $.tmEPOAdmin.section_logic_start();
            $.tmEPOAdmin.element_logic_start();

            $.tmEPOAdmin.set_fields_change();

            $.tmEPOAdmin.set_field_title();

            $(".builder_wrapper.tm-slider-wizard").each(function () {
                var bw = $(this);
                $.tmEPOAdmin.create_slider(bw);
            });

            $.tmEPOAdmin.init_sections_check();
            $.tmEPOAdmin.fix_content_float();

            $.tmEPOAdmin.fix_form_submit();

            $.tmEPOAdmin.pre_element_logic_init_done = false;
            $.tmEPOAdmin.isinit = false;

        },

        cpf_logic_element_onchange: function (e, ison) {

            var $this = $(this);
            var logic;
            var element;
            var section;
            var type;
            var cpf_logic_value;
            var select;
            var selectoperator;
            var value;

            if (e instanceof $) {
                $this = e;
            }
            if (ison === undefined) {
                ison = $(this).closest(".section_elements, .builder_wrapper, .bitem, .builder_element_wrap");
                if (ison.is(".section_elements") || ison.is(".builder_wrapper")) {
                    ison = false;
                } else {
                    ison = true;
                }
            }

            if (!ison) {
                logic = $.tmEPOAdmin.logic_object;
            } else {
                logic = $.tmEPOAdmin.element_logic_object;
            }

            element = $this.val();
            section = $this.children("option:selected").attr("data-section");
            type = $this.children("option:selected").attr("data-type");
            cpf_logic_value = logic;

            if (section in cpf_logic_value) {
                cpf_logic_value = logic[section].values;
                if (element in cpf_logic_value) {
                    cpf_logic_value = logic[section].values[element];
                } else {
                    cpf_logic_value = false;
                }
            } else {
                cpf_logic_value = false;
            }

            select = $this.closest(".tm-logic-rule").find(".tm-logic-value");
            selectoperator = $this.closest(".tm-logic-rule").find(".cpf-logic-operator");
            value = selectoperator.val();

            if (cpf_logic_value) {
                cpf_logic_value = $(cpf_logic_value);

                select.empty().append(cpf_logic_value);

                selectoperator.find("[value='is']").show();
                selectoperator.find("[value='isnot']").show();
                if (type === "variation" || type === "multiple") {
                    if (value === "startswith" || value === "endswith" || value === "greaterthan" || value === "lessthan") {
                        selectoperator.val("isempty");
                    }
                    selectoperator.find("[value='startswith']").hide();
                    selectoperator.find("[value='endswith']").hide();
                    selectoperator.find("[value='greaterthan']").hide();
                    selectoperator.find("[value='lessthan']").hide();
                    selectoperator.trigger("change.cpf");
                } else {
                    selectoperator.find("[value='startswith']").show();
                    selectoperator.find("[value='endswith']").show();
                    selectoperator.find("[value='greaterthan']").show();
                    selectoperator.find("[value='lessthan']").show();
                }
            } else {
                if (element === section) {
                    if (value === "is" || value === "isnot" || value === "startswith" || value === "endswith" || value === "greaterthan" || value === "lessthan") {
                        selectoperator.val("isempty");
                    }
                    selectoperator.find("[value='is']").hide();
                    selectoperator.find("[value='isnot']").hide();
                    selectoperator.find("[value='startswith']").hide();
                    selectoperator.find("[value='endswith']").hide();
                    selectoperator.find("[value='greaterthan']").hide();
                    selectoperator.find("[value='lessthan']").hide();
                    selectoperator.trigger("change.cpf");
                } else {
                    selectoperator.find("[value='is']").show();
                    selectoperator.find("[value='isnot']").show();
                    selectoperator.find("[value='startswith']").show();
                    selectoperator.find("[value='endswith']").show();
                    selectoperator.find("[value='greaterthan']").show();
                    selectoperator.find("[value='lessthan']").show();
                }
            }

        },

        cpf_logic_operator_onchange: function (e) {

            var $this = $(this);
            var value;
            var select;

            if (e instanceof $) {
                $this = e;
            }

            value = $this.val();
            select = $this.closest(".tm-logic-rule").find(".tm-logic-value");

            if (value === "isempty" || value === "isnotempty") {
                select.hide();
            } else {
                select.show();
            }

        },

        create_slider: function (bw) {

            bw.tmtabs({
                "headers": ".tm-slider-wizard-headers",
                "header": ".tm-slider-wizard-header",
                "selectedtab": 0,
                "showonhover": function () {
                    return $.tmEPOAdmin.is_element_dragged;
                },
                "useclasstohide": true,
                "afteraddtab": function (h, t) {
                    $.tmEPOAdmin.builder_items_sortable(t);
                    bw.find(".tm_builder_section_slides").val(function () {
                        if (!bw.is(".tm-slider-wizard")) {
                            return "";
                        }
                        return bw.find(".bitem_wrapper")
                        .map(function (i, e) {
                            return $(e).children(".bitem").not(".pl2, .element_is_disabled").length;
                        }).get().join(",");
                    });
                },
                "deletebutton": true,
                "deleteconfirm": true,
                "afterdeletetab": function () {
                    bw.find(".tm_builder_section_slides").val(function () {
                        if (!bw.is(".tm-slider-wizard")) {
                            return "";
                        }
                        return bw.find(".bitem_wrapper")
                        .map(function (i, e) {
                            return $(e).children(".bitem").not(".pl2, .element_is_disabled").length;
                        }).get().join(",");
                    });
                    $.tmEPOAdmin.builder_reorder_multiple();
                    $(".builder_layout .builder_wrapper").each(function (i, el) {
                        $.tmEPOAdmin.logic_init($(el));
                    });
                    $.tmEPOAdmin.init_sections_check();
                    $.tmEPOAdmin.fix_content_float();
                }
            });

        },

        sections_type_onChange: function (bw) {

            var bitem_wrapper = bw.find(".bitem_wrapper");
            var style = bw.find(".section_elements .sections_type").val();
            var tab1;
            var add;

            if (style === "slider" && !bw.hasClass("tm-slider-wizard")) {
                bw.addClass("tm-slider-wizard");
                tab1 = "<div class=\"tm-box\"><h4 class=\"tm-slider-wizard-header\" data-id=\"tm-slide0\">1</h4></div>";
                add = "<div class=\"tm-box tm-add-box\"><h4 class=\"tm-add-tab\"><span class=\"tcfa tcfa-plus\"></span></h4></div>";
                bitem_wrapper.before("<div class=\"transition tm-slider-wizard-headers\">" + tab1 + add + "</div>");
                bitem_wrapper.addClass("tm-slider-wizard-tab tm-slide0");

                $.tmEPOAdmin.create_slider(bw);

                bw.find(".tm_builder_section_slides").val(function () {
                    if (!bw.is(".tm-slider-wizard")) {
                        return "";
                    }
                    return bw.find(".bitem_wrapper")
                    .map(function (i, e) {
                        return $(e).children(".bitem").not(".pl2, .element_is_disabled").length;
                    }).get().join(",");
                });
            } else if (style !== "slider" && bw.hasClass("tm-slider-wizard")) {
                bw.find(".bitem_wrapper").wrapAll("<div class=\"tmtemp\"></div>");

                bw.find(".bitem_wrapper .bitem").appendTo(bw.find(".tmtemp"));
                bw.find(".bitem_wrapper").remove();

                bw.find(".tmtemp").addClass("bitem_wrapper").removeClass("tmtemp");
                $.tmEPOAdmin.builder_items_sortable(bw.find(".bitem_wrapper"));
                bw.find(".tm-slider-wizard-headers").remove();
                bw.removeClass("tm-slider-wizard");
                bw.find(".tm_builder_section_slides").val("");
            }

        },

        variation_events_success: function () {
            setTimeout(function () {
                $.tmEPOAdmin.setGlobalVariationObject("reindex");
            }, 600);
            $(document).unbind("ajaxSuccess", $.tmEPOAdmin.variation_events_success);
            $.tmEPOAdmin.var_remove("tma-remove_variation-added");
        },

        tm_variations_check_events_success: function () {
            setTimeout(function () {
                $.tmEPOAdmin.tm_variations_check_for_changes = 1;
                $.tmEPOAdmin.tm_variations_check();
            }, 600);
            $(document).unbind("ajaxSuccess", $.tmEPOAdmin.tm_variations_check_events_success);
            $.tmEPOAdmin.var_remove("tma-remove_variation-added");
        },

        add_variation_events: function () {

            if ($.tmEPOAdmin.var_is("tma-variation-events-added") === true) {
                return;
            }
            if ($.tmEPOAdmin.var_is("tma-remove_variation-added") !== true) {
                $("#variable_product_options").on("click.tma", ".remove_variation", function () {
                    $(document).ajaxSuccess($.tmEPOAdmin.variation_events_success);
                    $.tmEPOAdmin.var_is("tma-remove_variation-added", true);

                    $(document).ajaxSuccess($.tmEPOAdmin.tm_variations_check_events_success);
                });
            }
            if ($.tmEPOAdmin.var_is("tma-remove_variation-added") !== true) {
                $(".wc-metaboxes-wrapper").on("click", "a.bulk_edit", function () {
                    var bulk_edit = $("select#field_to_edit").val();
                    if (bulk_edit === "delete_all") {
                        $(document).ajaxSuccess($.tmEPOAdmin.variation_events_success);
                        $.tmEPOAdmin.var_is("tma-remove_variation-added", true);

                        $(document).ajaxSuccess($.tmEPOAdmin.tm_variations_check_events_success);
                    }
                });
            }
            $("#variable_product_options").on("woocommerce_variations_added", function () {
                $.tmEPOAdmin.setGlobalVariationObject("reindex");
                $(document).ajaxSuccess($.tmEPOAdmin.tm_variations_check_events_success);
            });

            $("#woocommerce-product-data").on("woocommerce_variations_saved", function () {
                $.tmEPOAdmin.setGlobalVariationObject("reindex");
                $(document).ajaxSuccess($.tmEPOAdmin.tm_variations_check_events_success);
            });

            $(document).on("click.cpf", ".save_attributes", function () {
                $(document).ajaxSuccess($.tmEPOAdmin.tm_variations_check_events_success);
            });

            $.tmEPOAdmin.var_is("tma-variation-events-added", true);

        },

        toggle_variation_button: function () {

            var product_type = $("#product-type");
            var variation_element;
            var is_forced;
            var variation_element_builder_wrapper;
            var _rlogictab;

            if (product_type.length) {
                if (product_type.val() === "variable" || product_type.val() === "variable-subscription") {
                    $(".builder_add_section").addClass("inline");
                    $(".builder_add_variation").addClass("inline").removeClass("tm-hidden");
                    $(".tma-variations-wrap").removeClass("tm-hidden");
                    $.tmEPOAdmin.add_variation_events();
                    variation_element = $(".builder_layout .element-variations");
                    is_forced = false;
                    if (!variation_element.length) {
                        $.tmEPOAdmin.var_is("tm-style-variation-forced", true);
                        $.tmEPOAdmin.builder_add_variation_onClick();
                        is_forced = true;
                        variation_element = $(".builder_layout .element-variations");
                    } else {
                        if (variation_element.find(".tm-variations-disabled").val() === "1") {
                            is_forced = true;
                            variation_element = $(".builder_layout .element-variations");
                            $.tmEPOAdmin.var_is("tm-style-variation-forced", true);
                        }
                    }
                    if (variation_element.length) {

                        variation_element_builder_wrapper = variation_element.closest(".builder_wrapper");
                        variation_element_builder_wrapper
                        .find(".tm-add-element-action,.tmicon.clone,.tmicon.size,.tmicon.move,.tmicon.plus,.tmicon.minus").remove();

                        variation_element_builder_wrapper.addClass("tma-nomove tma-variations-wrap");
                        variation_element_builder_wrapper
                        .find(".builder_hide_for_variation").hide();

                        _rlogictab = variation_element_builder_wrapper.find(".tma-tab-logic,.tma-tab-css,.tma-tab-woocommerce");
                        _rlogictab.hide();

                        $.tmEPOAdmin.var_is("tm-style-variation-added", true);

                        variation_element.addClass("tma-nomove");
                        variation_element.find(".tmicon.size,.tmicon.clone,.tmicon.move,.tmicon.plus,.tmicon.minus,.tmicon.delete").remove();
                        _rlogictab = variation_element.find(".tma-tab-logic,.tma-tab-css,.tma-tab-woocommerce");
                        _rlogictab.remove();

                        if (is_forced) {
                            variation_element.find(".tm-variations-disabled").val("1");
                            $(".builder_add_section").addClass("inline");
                            $(".builder_add_variation").addClass("inline").removeClass("tm-hidden");
                            $(".tma-variations-wrap").addClass("tm-hidden");
                        } else {

                            variation_element.find(".tm-variations-disabled").val("");
                            $(".builder_add_section").removeClass("inline");
                            $(".builder_add_variation").removeClass("inline").addClass("tm-hidden");
                            $(".tma-variations-wrap").removeClass("tm-hidden");

                        }

                    }
                } else {
                    $(".builder_add_section").removeClass("inline");
                    $(".builder_add_variation").removeClass("inline").addClass("tm-hidden");
                }
            }

        },

        can_take_logic: function () {
            return ".element-color,.element-range,.element-radiobuttons,.element-checkboxes,.element-selectbox,.element-textfield,.element-textarea,.element-variations";
        },

        prepare_for_json: function (data) {

            var result = {};
            var arr;
            var value;
            var must_be_array;

            Object.keys(data).forEach(function (i) {

                if (i.indexOf("tm_meta[") === 0) {
                    arr = i.split(/[\[\]]{1,2}/);
                    arr.pop();
                    arr = arr.map(function (item) {
                        return item === "" ? null : item;
                    });
                    if (arr.length > 0 && arr[arr.length - 1] === null) {
                        must_be_array = true;
                    } else {
                        must_be_array = false;
                    }
                    arr = arr.filter(function (v) {
                        if (v !== null && v !== undefined) {
                            return v;
                        }
                    });
                    if (typeof data[i] !== "object" && must_be_array) {
                        value = [data[i]];
                    } else {
                        value = data[i];
                    }
                    result = $.tmEPOAdmin.constructObject(arr, value, result);
                }

            });

            return result;

        },

        constructObject: function (a, final_value, obj) {

            var val = a.shift();

            if (a.length > 0) {
                if (!obj.hasOwnProperty(val)) {
                    obj[val] = {};
                }
                obj[val] = $.tmEPOAdmin.constructObject(a, final_value, obj[val]);
            } else {
                obj[val] = final_value;
            }

            return obj;

        },

        create_tm_meta_serialized: function () {

            var tm_meta;
            var data;
            var name;
            var tm_meta_serialized;
            var previewField = $("input#wp-preview");
            var $tc_form = $("#tmformfieldsbuilderwrap");
            var $post_obj = $("#post");
            var $editor_obj = $("#editor");
            var $post_form = $post_obj.length === 1 ? $post_obj : $editor_obj;

            tm_meta = $tc_form.find("[name^=\"tm_meta[\"]");

            $(".tm_meta_serialized").remove();
            $(".tm_meta_serialized_wpml").remove();

            tm_meta.attr("disabled", false);

            if (!$.tmEPOAdmin.is_original) {
                name = "tm_meta_serialized_wpml";
            } else {
                name = "tm_meta_serialized";
            }

            data = $.tmEPOAdmin.prepare_for_json($post_form.tcSerializeObject());
            data = $.tmEPOAdmin.tm_escape(JSON.stringify(data));
            tm_meta_serialized = $("<textarea class='tm_meta_serialized tm-hidden' name='" + name + "'></textarea>").val(data);
            $tc_form.prepend(tm_meta_serialized);

            tm_meta.attr("disabled", "disabled");
            if (previewField.length > 0 && previewField.val() !== "") {
                tm_meta.not(".tm-wmpl-disabled").attr("disabled", false);
                $(".tm_meta_serialized").remove();
            }

        },

        fix_form_submit: function () {

            var $post = $("#post");
            var found;
            var subscribe;
            var sub;

            if ($post.length === 1) {

                $post.on("submit", function () {
                    $.tmEPOAdmin.create_tm_meta_serialized($(this));
                    return true; // ensure form still submits
                });

            } else if (wp.data && "subscribe" in wp.data) {

                found = false;
                subscribe = wp.data.subscribe;

                if (typeof subscribe === "function") {

                    sub = function () {

                        var isSavingPost = wp.data.select("core/editor").isSavingPost();
                        var didPostSaveRequestSucceed = wp.data.select("core/editor").didPostSaveRequestSucceed();
                        var didPostSaveRequestFail = wp.data.select("core/editor").didPostSaveRequestFail();
                        var $tc_form;
                        var tm_meta;

                        if (!found && isSavingPost) {
                            found = true;
                            $.tmEPOAdmin.create_tm_meta_serialized();
                        }
                        if (found && ( didPostSaveRequestSucceed || didPostSaveRequestFail )) {
                            found = false;
                            $tc_form = $("#tm_extra_product_options");
                            tm_meta = $tc_form.find("[name^=\"tm_meta[\"]");
                            tm_meta.attr("disabled", false);
                            setTimeout(function () {
                                $(".tm_meta_serialized").remove();
                                $(".tm_meta_serialized_wpml").remove();
                            }, 600);
                        }
                    };

                    subscribe(sub);

                }

            }

        },

        init_sections_check: function () {

            var length = $(".builder_wrapper").length;

            if (length === 1) {
                if ($(".builder_wrapper.tma-variations-wrap.tm-hidden").length) {
                    length = 0;
                }
            }

            if (!length) {
                $(".builder_elements").hide();
                $(".builder-add-section-action").hide();
                $(".builder_selector").hide();
                $(".tc-welcome").show();
            } else {
                $(".builder_elements").show();
                $(".builder-add-section-action").show();
                $(".builder_selector").show();
                $(".tc-welcome").hide();
            }

        },

        fix_content_float: function () {

            var height;

            if ($(".builder_elements").is(":hidden")) {
                height = 0;
            } else {
                height = $(".builder_elements").outerHeight();

            }
            $("#wpcontent").css("margin-bottom", height + "px");

        },

        disable_categories: function () {
            if ($(".meta-disable-categories").is(":checked")) {
                $("#taxonomy-product_cat").slideUp();
            } else {
                $("#taxonomy-product_cat").slideDown();
            }
        },

        check_if_applied: function () {

            var nocat;
            var cat;
            var tm_product_ids;
            var tm_enabled_options;
            var tm_disabled_options;

            if (!$("body").is(".product_page_tm-global-epo")) {
                return;
            }

            nocat = $("#tm_meta_disable_categories:checked").length > 0;
            cat = $("#product_catdiv input:checkbox").not($("#tm_meta_disable_categories")).filter(":checked").length > 0;
            tm_product_ids = $("#tm_product_ids").val();
            tm_enabled_options = $("#tm_enabled_options").val();
            tm_disabled_options = $("#tm_disabled_options").val();
            tm_product_ids = tm_product_ids && tm_product_ids !== null ? tm_product_ids.length > 0 : false;
            tm_enabled_options = tm_enabled_options && tm_enabled_options !== null ? tm_enabled_options.length > 0 : false;
            tm_disabled_options = tm_disabled_options && tm_disabled_options !== null ? tm_disabled_options.length > 0 : false;
            if (nocat) {
                if (tm_product_ids || tm_enabled_options || tm_disabled_options) {
                    $(".tc-info-box").removeClass("tc-error tc-all-products").addClass("hidden").html("");
                } else {
                    $(".tc-info-box").removeClass("hidden tc-all-products").addClass("tc-error").html(TMEPOGLOBALADMINJS.i18n_form_not_applied_to_all);
                }
            } else {
                if (cat) {
                    $(".tc-info-box").removeClass("tc-error tc-all-products").addClass("hidden").html("");
                } else {
                    $(".tc-info-box").removeClass("hidden error").addClass("tc-all-products").html(TMEPOGLOBALADMINJS.i18n_form_is_applied_to_all);
                }
            }

        },

        check_section_logic: function (section) {

            if (!section && $.tmEPOAdmin.isinit && $.tmEPOAdmin.done_check_section_logic) {
                return;
            }
            if (!section) {
                section = $("#tmformfieldsbuilderwrap").find("div.builder_wrapper");
            }
            section.each(function (i, el) {

                var current_section = $(el);
                var this_section_id = current_section.find(".tm-builder-sections-uniqid").val();
                var this_section_activate_sections_logic;

                if (!this_section_id || this_section_id === "" || this_section_id === undefined || this_section_id === false) {
                    current_section.find(".tm-builder-sections-uniqid").val($.tm_uniqid("", true));
                }
                this_section_activate_sections_logic = parseInt(current_section.find(".activate-sections-logic").val(), 10);
                if (this_section_activate_sections_logic === 1) {
                    current_section.find(".builder-logic-div").show();
                } else {
                    current_section.find(".builder-logic-div").hide();
                }

            });
            $.tmEPOAdmin.done_check_section_logic = true;

        },

        check_element_logic: function (element) {

            var uniqids = [];
            var all = false;

            if (!element && $.tmEPOAdmin.isinit && $.tmEPOAdmin.done_check_section_logic) {
                return;
            }

            if (!element) {
                element = $("#tmformfieldsbuilderwrap").find("div.bitem");
                all = true;
            }

            element.each(function (i, el) {

                var this_element_id;
                var this_element_activate_element_logic;

                el = $(el);
                this_element_id = el.find(".tm-builder-element-uniqid").val();
                if ((all && uniqids.indexOf(this_element_id) !== -1 ) || !this_element_id || this_element_id === "" || this_element_id === undefined || this_element_id === false) {
                    el.find(".tm-builder-element-uniqid").val($.tm_uniqid("", true));
                }
                if (all) {
                    uniqids.push(el.find(".tm-builder-element-uniqid").val());
                }
                this_element_activate_element_logic = parseInt(el.find(".activate-element-logic").val(), 10);
                if (this_element_activate_element_logic === 1) {
                    el.find(".builder-logic-div").show();
                } else {
                    el.find(".builder-logic-div").hide();
                }

            });
            $.tmEPOAdmin.done_check_section_logic = true;

        },

        section_logic_start: function (section) {

            if (!section) {
                section = $(".builder_layout .builder_wrapper");
            }

            section.each(function (i, el) {

                var rules;

                el = $(el);
                $.tmEPOAdmin.logic_init(el);
                try {
                    rules = el.find(".section_elements .tm-builder-clogic").val() || "null";
                    rules = $.epoAPI.util.parseJSON(rules);
                    rules = $.tmEPOAdmin.logic_check_section_rules(rules);
                    el.find(".section_elements .tm-builder-clogic").val(JSON.stringify(rules));
                    el.find(".section_elements .epo-rule-toggle").val(rules.toggle);
                    el.find(".section_elements .epo-rule-what").val(rules.what);
                } catch (err) {
                    return;
                }

            });
        },

        element_logic_start: function (element) {

            var rules;

            if (!element) {
                element = $(".builder_layout .builder_wrapper .bitem");
            }
            element.each(function (i, el) {
                el = $(el);
                $.tmEPOAdmin.element_logic_init(el);
                try {
                    rules = el.find(".tm-builder-clogic").val() || "null";
                    rules = $.epoAPI.util.parseJSON(rules);
                    rules = $.tmEPOAdmin.logic_check_element_rules(rules);
                    el.find(".tm-builder-clogic").val(JSON.stringify(rules));
                    el.find(".epo-rule-toggle").val(rules.toggle);
                    el.find(".epo-rule-what").val(rules.what);
                } catch (err) {
                    return;
                }
            });

        },

        panels_reorder: function (obj) {
            $(obj).children(".options_wrap").each(function (i, el) {
                $(el).find(".tm-default-radio,.tm-default-checkbox").val(i);
            });
        },

        // Options sortable
        panels_sortable: function (obj) {

            if ($(obj).length === 0 || !$.tmEPOAdmin.is_original) {
                return;
            }

            obj.not($(".builder_elements .panels_wrap")).sortable({
                "handle": ".tm_cell_move",
                "cancel": "input,select,button",
                "cursor": "move",
                "tolerance": "pointer",
                "forcePlaceholderSize": true,
                "placeholder": "panel_wrap pl",
                "stop": function (e, ui) {
                    $.tmEPOAdmin.panels_reorder($(ui.item).closest(".panels_wrap"));
                }
            });

        },

        // Delete all options button
        builder_panel_delete_all_onClick: function (e) {

            var tcpagination = $(this).closest(".onerow").find(".tcpagination");
            var panels_wrap = $(".flasho.tm_wrapper").find(".panels_wrap");
            var options_wrap;

            e.preventDefault();
            $(this).trigger("hideTtooltip");

            tcpagination.tcPagination("destroy");

            if (panels_wrap.children().length > 1) {
                options_wrap = panels_wrap.find(".options_wrap");
                options_wrap.each(function (i) {
                    if (i === 0) {
                        return true;
                    }
                    $(this).remove();
                    panels_wrap.find(".numorder").each(function (i2) {
                        $(this).html(parseInt(i2, 10) + 1);
                    });
                });
                options_wrap.find("input").val("");
                $.tmEPOAdmin.panels_reorder(panels_wrap);

            }

        },

        // Remove image
        builder_image_delete_onClick: function (e) {
            e.preventDefault();
            $(this).trigger("hideTtooltip");
            $(this).closest(".tm_cell_images").find("input." + $(this).attr("rel")).val("");
            $(this).closest("span").find("img").attr("src", "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=");
        },

        // Delete options button
        builder_panel_delete_onClick: function (e) {

            var _panels_wrap = $(this).closest(".panels_wrap");

            e.preventDefault();
            $(this).trigger("hideTtooltip");

            if (_panels_wrap.children().length > 1) {
                $(this).closest(".options_wrap").css({
                    "margin": "0 auto"
                }).animate({
                    "opacity": 0,
                    "height": 0,
                    "width": 0
                }, 300, function () {
                    $(this).remove();
                    _panels_wrap.find(".numorder").each(function (i2) {
                        $(this).html(parseInt(i2, 10) + 1);
                    });
                    _panels_wrap.children(".options_wrap").each(function (k) {
                        $(this).find("[id]").each(function () {
                            var _name = $(this).attr("name").replace(/[\[\]]/g, "");
                            $(this).attr("id", _name + "_" + k);
                        });
                    });
                    $.tmEPOAdmin.panels_reorder(_panels_wrap);
                });
            }

        },

        // Mass add options button
        builder_panel_mass_add_onClick: function (e) {

            var html;
            var element = $(this);

            e.preventDefault();
            if (element.is(".disabled")) {
                return;
            }
            element.addClass("disabled");
            html = "<div class=\"tm-panel-populate-wrapper\">" +
                "<textarea class=\"tm-panel-populate\"></textarea>" +
                "<button type=\"button\" class=\"tc tc-button builder-panel-populate\">" + TMEPOGLOBALADMINJS.i18n_populate + "</button>" +
                "</div>";
            element.after(html);

        },

        // Populate options button
        builder_panel_populate_onClick: function (e) {

            var panels_wrap = $(".flasho.tm_wrapper").find(".panels_wrap");
            var _last = panels_wrap.children();
            var full_element = $("");
            var lines = $(".tm-panel-populate").val().split(/\n/);
            var texts = [];

            e.preventDefault();
            $(this).remove();

            lines.forEach(function (value) {
                if (/\S/.test(value)) {
                    texts.push($.trim(value));
                }
            });

            texts.forEach(function (value) {

                var line = value.split("|");
                var len = line.length;
                var toadd;

                if (len !== 0) {
                    if (len === 1) {
                        line[1] = 0;
                    }
                    line[0] = $.trim(line[0]);
                    line[1] = parseFloat($.trim(line[1]));
                    if (!Number.isFinite(line[1])) {
                        line[1] = "";
                    }
                    toadd = $.tmEPOAdmin.add_panel_row(line, panels_wrap, _last);

                    full_element = full_element.add(toadd);
                }

            });
            if (full_element.length) {
                panels_wrap.append(full_element);
                $.tcToolTip(full_element.find(".tm-tooltip"));
            }
            $(".builder-panel-mass-add").removeClass("disabled");
            $(".tm-panel-populate-wrapper").remove();
            $.tmEPOAdmin.paginattion_init("last");

        },

        add_panel_row: function (line, panels_wrap, _last) {

            var _clone = _last.last().tcClone();

            if (_clone) {

                $.tmEPOAdmin.builder_clone_after_events(_clone);
                $.tmEPOAdmin.gen_events(_clone);
                _clone.find("[name]").val("");
                _clone.find("[id]").each(function () {

                    var _name = $(this).attr("name").replace(/[\[\]]/g, "");
                    var _l = _last.length;

                    $(this).attr("id", _name + "_" + _l);

                });
                _clone.find(".tm_option_title").val(line[0]);
                _clone.find(".tm_option_value").val(line[0]);
                _clone.find(".tm_option_price").val(line[1]);
                if (line[2]) {
                    _clone.find(".tm_option_price_type").val(line[2]);
                    if (_clone.find(".tm_option_price_type").val() === false) {
                        _clone.find(".tm_option_price_type").val("");
                    }
                }
                if (line[3]) {
                    _clone.find(".tm_option_description").val(line[3]);
                    if (_clone.find(".tm_option_description").val() === false) {
                        _clone.find(".tm_option_description").val("");
                    }
                }
                _clone.find(".numorder").html(parseInt(parseInt(_last.length, 10) + 1, 10));
                _clone.find(".tm_upload_image img").attr("src", "");
                _clone.find("input.tm_option_image").val("");
                _clone.find(".tm-default-radio,.tm-default-checkbox").removeAttr("checked").prop("checked", false).val(_last.length);

                return _clone;

            }

            return $("");

        },

        // Add options button
        builder_panel_add_onClick: function (e) {

            var panels_wrap = $(this).prev(".panels_wrap");
            var _last = panels_wrap.children();
            var _clone = _last.last().tcClone();
            var isfee;

            e.preventDefault();
            if (_clone) {
                isfee = panels_wrap.find(".multiple_radiobuttons_options").first().val();
                $.tmEPOAdmin.builder_clone_after_events(_clone);
                $.tmEPOAdmin.gen_events(_clone);
                _clone.find("[name]").val("");
                _clone.find("[id]").each(function () {
                    var _name = $(this).attr("name").replace(/[\[\]]/g, "");
                    var _l = _last.length;
                    $(this).attr("id", _name + "_" + _l);
                });
                _clone.find(".numorder").html(parseInt(parseInt(_last.length, 10) + 1, 10));
                _clone.find(".tm_upload_image img").attr("src", "");
                _clone.find("input.tm_option_image").val("");
                _clone.find(".tm-default-radio,.tm-default-checkbox").removeAttr("checked").prop("checked", false).val(_last.length);
                if (isfee === "fee"){
                    _clone.find(".tm_option_price_type").val("fee");
                } else if (isfee === "subscriptionfee"){
                    _clone.find(".tm_option_price_type").val("subscriptionfee");
                }

                panels_wrap.append(_clone);
                $.tcToolTip(_clone.find(".tm-tooltip"));
                $.tmEPOAdmin.paginattion_init("last");
                $.tmEPOAdmin.tm_upload();
            }

        },

        // Section add button
        builder_add_section_onClick: function (e, ap) {

            var _template = $.epoAPI.template.html(templateEngine.tc_builder_section, {});
            var _clone;

            if (e) {
                e.preventDefault();
            }

            if (_template) {
                _clone = $(_template);
                if (_clone) {
                    _clone.addClass("w100");
                    _clone.addClass("appear");
                    _clone.find(".tm-builder-sections-uniqid").val($.tm_uniqid("", true));

                    if (ap) {
                        _clone.appendTo(".builder_layout");
                    } else {
                        if ($(".builder_layout .tma-variations-wrap").length > 0) {
                            $(".builder_layout .tma-variations-wrap").after(_clone);
                        } else {
                            _clone.prependTo(".builder_layout");
                        }
                    }

                    $.tmEPOAdmin.gen_events(_clone);
                    _clone.find(".tm-tabs").tmtabs();
                    $.tmEPOAdmin.check_section_logic(_clone);
                    $.tmEPOAdmin.logic_init(_clone);
                    $.tmEPOAdmin.builder_items_sortable(_clone.find(".bitem_wrapper"));
                    $.tmEPOAdmin.builder_reorder_multiple();
                    if ($(this).is("a")) {
                        $(window).tcScrollTo(_clone);
                    }
                    $.tmEPOAdmin.init_sections_check();
                    $.tmEPOAdmin.fix_content_float();

                    return _clone;
                }
            }

            return false;

        },

        builder_add_element_onClick: function (e) {

            var $this = $(this);
            var $_html = $.tmEPOAdmin.builder_floatbox_template_import({
                "id": "temp_for_floatbox_insert",
                "html": "<div class=\"tm-inner\">" + TMEPOGLOBALADMINJS.element_data + "</div>",
                "title": TMEPOGLOBALADMINJS.i18n_add_element
            });
            var popup = $.tcFloatBox({
                "closefadeouttime": 0,
                "animateOut": "",
                "fps": 1,
                "ismodal": false,
                "refresh": "fixed",
                "width": "70%",
                "height": "70%",
                "top": "15%",
                "left": "15%",
                "classname": "flasho tm_wrapper tc-builder-add-element",
                "data": $_html
            });

            if (e) {
                e.preventDefault();
            }

            $(".tc-builder-add-element .tc-element-button").on("click.cpf", function (ev) {

                var new_section = $this.closest(".builder_wrapper");
                var el = $(this).attr("data-element");

                ev.preventDefault();

                if ($this.is(".tc-prepend")) {
                    $.tmEPOAdmin.builder_clone_element(el, new_section, "prepend");
                } else {
                    $.tmEPOAdmin.builder_clone_element(el, new_section);
                }

                $.tmEPOAdmin.logic_reindex();
                popup.destroy();

            });

        },

        builder_add_section_and_element_onClick: function (e) {

            var $_html = $.tmEPOAdmin.builder_floatbox_template_import({
                "id": "temp_for_floatbox_insert",
                "html": "<div class=\"tm-inner\">" + TMEPOGLOBALADMINJS.element_data + "</div>",
                "title": TMEPOGLOBALADMINJS.i18n_add_element
            });
            var popup = $.tcFloatBox({
                "closefadeouttime": 0,
                "animateOut": "",
                "fps": 1,
                "ismodal": false,
                "refresh": "fixed",
                "width": "70%",
                "height": "70%",
                "top": "15%",
                "left": "15%",
                "classname": "flasho tm_wrapper tc-builder-add-section-and-element",
                "data": $_html
            });

            if (e) {
                e.preventDefault();
            }

            $(".tc-builder-add-section-and-element .tc-element-button").on("click.cpf", function (ev) {

                var new_section = $.tmEPOAdmin.builder_add_section_onClick(false, true);
                var el;

                ev.preventDefault();

                if (new_section) {
                    el = $(this).attr("data-element");
                    $.tmEPOAdmin.builder_clone_element(el, new_section);
                    $.tmEPOAdmin.logic_reindex();
                    popup.destroy();
                }

            });

        },

        tm_variations_check_for_changes: 0,

        tm_variations_check: function () {

            var variation_element = $(".builder_layout .element-variations");
            var data;

            if (!variation_element.length) {
                return;
            }

            if ($.tmEPOAdmin.tm_variations_check_for_changes === 1 && TMEPOADMINJS) {
                $("#tm_extra_product_options").block({
                    message: null,
                    overlayCSS: {
                        background: "#fff url(" + TMEPOADMINJS.plugin_url + "/assets/images/ajax-loader.gif) no-repeat center",
                        opacity: 0.6
                    }
                });
                data = {
                    "action": "woocommerce_tm_variations_check",
                    "post_id": TMEPOADMINJS.post_id,
                    "security": TMEPOADMINJS.check_attributes_nonce
                };
                $.post(TMEPOADMINJS.ajax_url, data, function (response) {
                    $(".tma-variations-wrap .tm-all-attributes").html(response);
                    $("#tm_extra_product_options").unblock();
                    $("#tm_extra_product_options").trigger("woocommerce_tm_variations_check_loaded");
                    $.tmEPOAdmin.tm_variations_check_for_changes = 0;
                    $.tmEPOAdmin.builder_reorder_multiple();
                });
            }

        },

        // Variation delete button
        builder_variation_delete_onClick: function () {
            $.tmEPOAdmin.var_is("tm-style-variation-forced", true);
            $(".builder_add_section").addClass("inline");
            $(".builder_add_variation").addClass("inline").removeClass("tm-hidden");
            if ($(".tma-variations-wrap").length === 2) {
                $(".tma-variations-wrap").eq(1).remove();
            }
            $(".tma-variations-wrap").addClass("tm-hidden");
            $(".tma-variations-wrap").find(".tm-variations-disabled").val("1");
            $.tmEPOAdmin.init_sections_check();
        },

        // Variation button
        builder_add_variation_onClick: function (e) {

            var _template;
            var _clone;
            var _rlogictab;
            var _clone2;

            if (e) {
                e.preventDefault();
            }

            if ($.tmEPOAdmin.var_is("tm-style-variation-added") === true) {
                if ($.tmEPOAdmin.var_is("tm-style-variation-forced") === true) {
                    $.tmEPOAdmin.var_is("tm-style-variation-forced", false);
                    $(".builder_add_variation").addClass("tm-hidden");
                    $(".builder_add_section").removeClass("inline");
                    $(".tma-variations-wrap").removeClass("tm-hidden");
                    $(".tma-variations-wrap").find(".tm-variations-disabled").val("");
                    $.tmEPOAdmin.init_sections_check();
                }
                return;
            }

            _template = $.epoAPI.template.html(templateEngine.tc_builder_section, {});
            if (_template) {
                _clone = $(_template);
                if (_clone) {
                    _clone.addClass("w100");
                    _clone.addClass("appear");
                    _clone.find(".tm-builder-sections-uniqid").val($.tm_uniqid("", true));

                    _clone.find(".tm-add-element-action,.tmicon.clone,.tmicon.size,.tmicon.move,.tmicon.plus,.tmicon.minus").remove();
                    _clone.addClass("tma-nomove tma-variations-wrap");
                    _clone.find(".builder_hide_for_variation").hide();

                    _rlogictab = _clone.find(".tma-tab-logic,.tma-tab-css,.tma-tab-woocommerce");
                    _rlogictab.hide();
                    _clone.prependTo(".builder_layout");
                    $.tmEPOAdmin.gen_events(_clone);
                    _clone.find(".tm-tabs").tmtabs();
                    $.tmEPOAdmin.check_section_logic(_clone);
                    $.tmEPOAdmin.logic_init(_clone);

                    $.tmEPOAdmin.init_sections_check();
                    $.tmEPOAdmin.fix_content_float();
                    $.tmEPOAdmin.var_is("tm-style-variation-added", true);

                    _clone2 = $.tmEPOAdmin.builder_clone_element("variations", $(".builder_layout").find(".builder_wrapper").first());
                    if ($.tmEPOAdmin.var_is("tm-style-variation-forced") === true) {
                        $(".builder_add_section").addClass("inline");
                        $(".builder_add_variation").addClass("inline").removeClass("tm-hidden");
                        $(".tma-variations-wrap").addClass("tm-hidden");
                        $(".tma-variations-wrap").find(".tm-variations-disabled").val("1");
                    } else {
                        $(".builder_add_variation").addClass("tm-hidden");
                        $(".builder_add_section").removeClass("inline");
                        $(".tma-variations-wrap").removeClass("tm-hidden");
                        $.tmEPOAdmin.var_is("tm-style-variation-forced", false);
                        $(".tma-variations-wrap").find(".tm-variations-disabled").val("");
                    }

                    _clone2.find(".tmicon.size,.tmicon.clone,.tmicon.move,.tmicon.plus,.tmicon.minus,.tmicon.delete").remove();
                    _rlogictab = _clone2.find(".tma-tab-logic,.tma-tab-css,.tma-tab-woocommerce");
                    _clone2.addClass("tma-nomove");
                    _clone2.find(".builder_hide_for_variation").hide();
                    _rlogictab.hide();
                    $.tmEPOAdmin.logic_reindex_force();

                    $.tmEPOAdmin.tm_variations_check_for_changes = 1;
                    $.tmEPOAdmin.tm_variations_check();
                }
            }

        },

        var_is: function (v, d) {
            if (!d) {
                return $("body").data(v);
            } else {
                $("body").data(v, d);
                return;
            }
        },

        var_remove: function (v) {
            if (v) {
                $("body").removeData(v);
            }
        },

        element_logic_object: {},

        logic_object: {},

        logic_operators: {
            "is": TMEPOGLOBALADMINJS.i18n_is,
            "isnot": TMEPOGLOBALADMINJS.i18n_is_not,
            "isempty": TMEPOGLOBALADMINJS.i18n_is_empty,
            "isnotempty": TMEPOGLOBALADMINJS.i18n_is_not_empty,
            "startswith": TMEPOGLOBALADMINJS.i18n_starts_with,
            "endswith": TMEPOGLOBALADMINJS.i18n_ends_with,
            "greaterthan": TMEPOGLOBALADMINJS.i18n_greater_than,
            "lessthan": TMEPOGLOBALADMINJS.i18n_less_than
        },

        tm_escape: function (val) {
            return encodeURIComponent(val);
        },

        tm_unescape: function (val) {
            return decodeURIComponent(val);
        },

        get_element_logic_init: function (do_section) {
            if (!$.tmEPOAdmin.pre_element_logic_init_done) {
                $.tmEPOAdmin.pre_element_logic_init(do_section);
            }
            if (!$.tmEPOAdmin.isinit) {
                $.tmEPOAdmin.pre_element_logic_init_done = false;
            } else {
                $.tmEPOAdmin.pre_element_logic_init_done = true;
            }
            return $.tmEPOAdmin.pre_element_logic_init_obj;
        },
        get_element_logic_options_init: function (do_section) {
            if (!$.tmEPOAdmin.pre_element_logic_init_done) {
                $.tmEPOAdmin.pre_element_logic_init(do_section);
            }
            if (!$.tmEPOAdmin.isinit) {
                $.tmEPOAdmin.pre_element_logic_init_done = false;
            } else {
                $.tmEPOAdmin.pre_element_logic_init_done = true;
            }
            return $.tmEPOAdmin.pre_element_logic_init_obj_options;
        },
        find_index: function (is_slider, field, include, exlcude) {

            var sib = 0;
            var $lis;

            if (is_slider) {
                sib = field.closest(".bitem_wrapper").prevAll(".bitem_wrapper").find(".bitem").length;
            }
            if (include && exlcude) {
                $lis = field.parent().find(include).not(exlcude);
                return parseInt(sib, 10) + parseInt($lis.index(field), 10);
            }

            return parseInt(sib, 10) + parseInt(field.index(), 10);

        },
        setGlobalVariationObject: function (logic, do_section) {

            var data;
            var c_ajaxurl;

            if (TMEPOADMINJS) {
                $("#tm_extra_product_options").block({
                    message: null,
                    overlayCSS: {
                        background: "#fff url(" + TMEPOADMINJS.plugin_url + "/assets/images/ajax-loader.gif) no-repeat center",
                        opacity: 0.6
                    }
                });
                data = {
                    "action": "woocommerce_tm_get_variations_array",
                    "post_id": TMEPOADMINJS.post_id,
                    "security": TMEPOADMINJS.check_attributes_nonce
                };
                c_ajaxurl = window.ajaxurl || TMEPOADMINJS.ajax_url;

                $.post(c_ajaxurl, data, function (response) {

                    if (response) {
                        globalVariationObject = response;
                        if (logic === true) {
                            $.tmEPOAdmin.pre_element_logic_init_set(do_section);
                        } else if (logic === "reindex") {
                            $.tmEPOAdmin.logic_reindex_force();
                        } else if (logic === "initialitize_on") {
                            $.tmEPOAdmin.initialitize_on();
                        } else if (logic === "initialitize_on_after") {
                            $.tmEPOAdmin.initialitize_on_after();
                        }
                    }
                }, "json")
                .always(function () {
                    $("#tm_extra_product_options").unblock();
                });
            } else {
                if (logic === "initialitize_on") {
                    if (!globalVariationObject) {
                        globalVariationObject = {};
                    }
                    $.tmEPOAdmin.initialitize_on();
                } else if (logic === "initialitize_on_after") {
                    if (!globalVariationObject) {
                        globalVariationObject = {};
                    }
                    $.tmEPOAdmin.initialitize_on_after();
                }
            }

        },

        pre_element_logic_init: function (do_section) {
            if (!globalVariationObject) {
                $.tmEPOAdmin.setGlobalVariationObject(true, do_section);
            } else {
                $.tmEPOAdmin.pre_element_logic_init_set(do_section);
            }
        },

        pre_element_logic_init_set: function (do_section) {

            var options;
            var logicobj;
            var sections;
            var log_section_id;
            var section_id;
            var fields;
            var values;
            var is_slider;
            var field_values;
            var name;
            var field_index;
            var has_enabled;
            var is_enabled;
            var value;
            var internal_name;
            var field_type;
            var tm_title;
            var tm_title_label;
            var tm_option_titles;
            var tm_option_values;
            var _section_name;

            if (!globalVariationObject) {
                return;
            }
            $.tmEPOAdmin.pre_element_logic_init_obj = {};
            $.tmEPOAdmin.pre_element_logic_init_obj_options = {};

            options = {};
            logicobj = {};
            sections = $(".builder_layout .builder_wrapper");
            log_section_id = [];

            sections.each(function (i, section) {
                section = $(section);
                section_id = section.find(".tm-builder-sections-uniqid").val();

                // Check if section id exists
                if ((log_section_id.indexOf(section_id) !== -1)) {
                    section.find(".tm-builder-sections-uniqid").val($.tm_uniqid("", true));
                    section_id = section.find(".tm-builder-sections-uniqid").val();
                }
                log_section_id.push(section_id);

                options[section_id] = [];
                if (do_section) {
                    $.tmEPOAdmin.check_section_logic(section);
                }
                _section_name = section.find(".tm-internal-name").val() || "Section";
                if (!section.is(".tma-variations-wrap")) {
                    options[section_id][0] = "<option data-type=\"section\" data-section=\"" + section_id + "\" value=\"" + section_id + "\">" + _section_name + " (" + section_id + ")</option>";
                }

                fields = section.find($.tmEPOAdmin.can_take_logic()).not(".element_is_disabled");
                values = [];
                is_slider = section.is(".tm-slider-wizard");
                field_values = [];

                // All the fields of current section that can be used as selector in logic
                fields.each(function (ii, field) {
                    field = $(field);
                    name = field.find("[name^=\"tm_meta\\[tmfbuilder\\]\\[\"][name$=\"_header_title\\]\\[\\]\"]");
                    field_index = $.tmEPOAdmin.find_index(is_slider, field, ".bitem", ".element_is_disabled");
                    has_enabled = field.find(".is_enabled");
                    is_enabled = field.find(".is_enabled").val() === "1";

                    if (has_enabled.length && !is_enabled) {
                        return true;
                    }

                    if (name.length === 1) {
                        value = name.val();
                        if (value.length === 0) {
                            value = name.closest(".bitem").find(".tm-label").text();
                        }
                        internal_name = name.closest(".bitem").find(".tm-internal-name").val();
                        if (internal_name !== value) {
                            value = value + " (" + internal_name + ")";
                        }

                        field_type = field.is(".element-variations") ? "variation" : (field.is(".element-radiobuttons,.element-checkboxes,.element-selectbox")) ? "multiple" : "text";
                        options[section_id][field_index + 1] = "<option data-type=\"" + field_type + "\" data-section=\"" + section_id + "\" value=\"" + field_index + "\">" + value + "</option>";

                        if (field.is(".element-variations")) {

                            field_values = [];
                            $(globalVariationObject.variations).each(function (index, variation) {
                                tm_title = [];
                                $(variation.attributes).each(function (i, sel) {
                                    var arr = $.map(sel, function (el) {
                                        return el;
                                    });

                                    $(arr).each(function (i2, sel2) {
                                        tm_title.push(sel2);
                                    });

                                });
                                tm_title = tm_title.join(" - ");
                                tm_title_label = tm_title;
                                try {
                                    tm_title_label = $.tmEPOAdmin.tm_unescape(tm_title);
                                } catch (err) {
                                    tm_title_label = tm_title;
                                }
                                field_values.push("<option value=\"" + $.tmEPOAdmin.tm_escape(variation.variation_id) + "\">" + tm_title_label + "</option>");
                            });

                            values[field_index] = "<select data-element=\"" + field_index + "\" data-section=\"" + section_id + "\" class=\"cpf-logic-value\">" + field_values.join("") + "</select>";
                        }
                        else if (field.is(".element-radiobuttons,.element-checkboxes,.element-selectbox")) {

                            tm_option_titles = field.find(".tm_option_title");
                            tm_option_values = field.find(".tm_option_value");
                            field_values = [];

                            tm_option_titles.each(function (index, title) {
                                field_values.push("<option value=\"" + $.tmEPOAdmin.tm_escape($(tm_option_values[index]).val()) + "\">" + $(title).val() + "</option>");
                            });

                            values[field_index] = "<select data-element=\"" + field_index + "\" data-section=\"" + section_id + "\" class=\"cpf-logic-value\">" + field_values.join("") + "</select>";

                        } else {

                            values[field_index] = "<input data-element=\"" + field_index + "\" data-section=\"" + section_id + "\" class=\"cpf-logic-value\" type=\"text\" value=\"\">";

                        }
                    }
                });

                logicobj[section_id] = {
                    "values": values
                };

            });
            $.tmEPOAdmin.pre_element_logic_init_obj = logicobj;
            $.tmEPOAdmin.pre_element_logic_init_obj_options = options;

        },

        element_logic_init: function (el) {

            var _el = $(el);
            var is_slider = _el.closest(".builder_wrapper").is(".tm-slider-wizard");
            var field_index = $.tmEPOAdmin.find_index(is_slider, _el, ".bitem", ".element_is_disabled");
            var options = [];
            var section_to_find;
            var section_id;
            var logicobj;
            var options_pre;

            $.tmEPOAdmin.check_section_logic();
            $.tmEPOAdmin.check_element_logic(_el);

            logicobj = $.extend(true, {}, $.tmEPOAdmin.get_element_logic_init());
            options_pre = $.extend(true, {}, $.tmEPOAdmin.get_element_logic_options_init());
            section_to_find = _el.closest(".builder_layout .builder_wrapper");
            section_id = section_to_find.find(".tm-builder-sections-uniqid").val();

            if (section_to_find && section_id && logicobj[section_id] && logicobj[section_id].values[field_index]) {
                delete logicobj[section_id].values[field_index];
                delete options_pre[section_id][field_index + 1];
                delete options_pre[section_id][0];
            } else if (section_to_find && section_id && options_pre[section_id] && options_pre[section_id][0]) {
                delete options_pre[section_id][0];
            }
            $.each(options_pre, function (i, c) {
                if (c) {
                    $.each(c, function (i, d) {
                        if (d) {
                            options.push(d);
                        }
                    });
                }
            });
            if (!$.tmEPOAdmin.element_logic_object.init) {
                $.tmEPOAdmin.element_logic_object.init = true;
            }
            $.tmEPOAdmin.element_logic_object = $.extend($.tmEPOAdmin.element_logic_object, logicobj);
            $.tmEPOAdmin.logic_append(el, options);

        },

        logic_init: function (el) {

            var options = [];
            var logicobj = {};
            var options_pre;
            var section_id;

            el = $(el);
            $.tmEPOAdmin.check_section_logic(el);

            logicobj = $.extend(true, {}, $.tmEPOAdmin.get_element_logic_init(true));

            options_pre = $.extend(true, {}, $.tmEPOAdmin.get_element_logic_options_init(true));
            section_id = el.find(".tm-builder-sections-uniqid").val();
            if (el && section_id && logicobj[section_id]) {
                delete logicobj[section_id];
                delete options_pre[section_id];
            }
            $.each(options_pre, function (i, c) {
                if (c) {
                    $.each(c, function (i, d) {
                        if (d) {
                            options.push(d);
                        }
                    });
                }
            });
            if (!$.tmEPOAdmin.logic_object.init) {
                $.tmEPOAdmin.logic_object.init = true;
            }

            $.tmEPOAdmin.logic_object = $.extend($.tmEPOAdmin.logic_object, logicobj);

            $.tmEPOAdmin.logic_append(el, options);

        },

        logic_check_section_rules: function (rules) {

            var copy;
            var _logic;

            if (typeof rules !== "object" || rules === null) {
                rules = {};
            }
            if (!("toggle" in rules)) {
                rules.toggle = "show";
            }
            if (!("what" in rules)) {
                rules.what = "any";
            }
            if (!("rules" in rules)) {
                rules.rules = [];
            }
            copy = rules;
            _logic = $.tmEPOAdmin.logic_object;
            $.each(rules.rules, function (i, _rule) {
                var section = _rule.section;
                var element = _rule.element;
                var found = ((section in _logic) && (element in _logic[section].values)) || (section === element);
                if (!found) {
                    delete copy.rules[i];
                }
            });
            copy.rules = $.tm_array_values(copy.rules);

            return copy;

        },

        logic_check_element_rules: function (rules) {

            var copy;
            var _logic;

            if (typeof rules !== "object" || !rules) {
                rules = {};
            }
            if (!("toggle" in rules)) {
                rules.toggle = "show";
            }
            if (!("what" in rules)) {
                rules.what = "any";
            }
            if (!("rules" in rules)) {
                rules.rules = [];
            }
            copy = rules;
            _logic = $.tmEPOAdmin.element_logic_object;
            $.each(rules.rules, function (i, _rule) {
                var section = _rule.section;
                var element = _rule.element;
                var found = ((section in _logic) && (element in _logic[section].values)) || (section = element);
                if (!found) {
                    delete copy.rules[i];
                }
            });
            copy.rules = $.tm_array_values(copy.rules);

            return copy;

        },

        logic_append: function (el, options) {

            var obj;
            var logic;
            var rawrules;
            var rulesobj;
            var h;
            var rule;
            var tm_logic_element;
            var operators;
            var o;
            var ruleshtml;
            var current_rule;
            var set_select;
            var rules;
            var elementDoesItHaveLogic;

            el = $(el);
            if (el.is(".bitem")) {
                obj = el.find(".builder_element_wrap");
            } else {
                obj = el.find(".section_elements");
            }
            logic = $(obj).find(".tm-logic-wrapper");
            if (!options || options.length === 0) {
                logic.html("<div class=\"errortitle\"><p>" + TMEPOGLOBALADMINJS.i18n_cannot_apply_rules + "</p></div>");
                return false;
            }

            try {
                if (el.is(".bitem")) {
                    elementDoesItHaveLogic = $(obj).find(".activate-element-logic").val() || "";
                } else {
                    elementDoesItHaveLogic = $(obj).find(".activate-sections-logic").val() || "";
                }
                if (elementDoesItHaveLogic === "1") {
                    rawrules = $(obj).find(".tm-builder-clogic").val() || "null";
                } else {
                    rawrules = "null";
                }
                rulesobj = $.epoAPI.util.parseJSON(rawrules);
                if (el.is(".bitem")) {
                    rules = $.tmEPOAdmin.logic_check_element_rules(rulesobj);
                } else {
                    rules = $.tmEPOAdmin.logic_check_section_rules(rulesobj);
                }
                $(obj).find(".tm-builder-clogic").val(JSON.stringify(rules));

            } catch (err) {
                rules = false;
            }
            logic.empty();
            h = "";
            h = "<div class=\"tm-row nopadding tm-logic-rule\">" + "<div class=\"tm-cell col-4 tm-logic-element\">" + "</div>" + "<div class=\"tm-cell col-2 tm-logic-operator\">" + "</div>" + "<div class=\"tm-cell col-4 tm-logic-value\">" + "</div>" + "<div class=\"tm-cell col-2 tm-logic-func\">" + "<button type=\"button\" class=\"tc tc-button cpf-add-rule\"><i class=\"tcfa tcfa-plus\"></i></button>" + " <button type=\"button\" class=\"tc tc-button cpf-delete-rule\"><i class=\"tcfa tcfa-times\"></i></button>" + "</div>" + "</div>";
            rule = $(h);
            tm_logic_element = $("<select class=\"cpf-logic-element\">" + options.join("") + "</select>");
            operators = "";

            for (o in $.tmEPOAdmin.logic_operators) {
                if ($.tmEPOAdmin.logic_operators.hasOwnProperty(o)) {
                    operators = operators + "<option value=\"" + o + "\">" + $.tmEPOAdmin.logic_operators[o] + "</option>";
                }
            }
            operators = $("<select class=\"cpf-logic-operator\">" + operators + "</select>");

            rule.find(".tm-logic-element").append(tm_logic_element);
            rule.find(".tm-logic-operator").append(operators);

            if (!rules || !("rules" in rules) || !rules.rules.length) {
                rule.appendTo(logic).find(".cpf-logic-element").trigger("change.cpf", [el.is(".bitem")]);
                rule.appendTo(logic).find(".cpf-logic-operator").trigger("change.cpf", [el.is(".bitem")]);
            } else {
                ruleshtml = $("<div class=\"temp\">");
                $.each(rules.rules, function (i, _rule) {
                    if (_rule && typeof(_rule) === "object") {
                        current_rule = rule.clone();
                        set_select = current_rule.find(".cpf-logic-element").find("option[data-section=\"" + _rule.section + "\"][value=\"" + _rule.element + "\"]");

                        if ($(set_select).length) {
                            $(set_select)[0].selected = true;
                        }
                        $.tmEPOAdmin.cpf_logic_element_onchange(current_rule.find(".cpf-logic-element"), el.is(".bitem"));

                        current_rule.find(".cpf-logic-operator").val(_rule.operator);
                        $.tmEPOAdmin.cpf_logic_operator_onchange(current_rule.find(".cpf-logic-operator"), el.is(".bitem"));

                        if (current_rule.find(".cpf-logic-value").is("select")) {
                            current_rule.find(".cpf-logic-value").val($.tmEPOAdmin.tm_escape($.tmEPOAdmin.tm_unescape(_rule.value)));
                        } else {
                            current_rule.find(".cpf-logic-value").val(($.tmEPOAdmin.tm_unescape(_rule.value)));
                        }
                        ruleshtml.append(current_rule);
                    }
                });
                ruleshtml = ruleshtml.children();
                logic.append(ruleshtml);
            }
        },

        logic_get_JSON: function (s) {

            var rules = $(s).find(".builder-logic-div");
            var this_section_id = s.find(".tm-builder-sections-uniqid").val();
            var section_logic = {};
            var _toggle = rules.find(".epo-rule-toggle").val();
            var _what = rules.find(".epo-rule-what").val();
            var $cpf_logic_element;
            var cpf_logic_section;
            var cpf_logic_element;
            var cpf_logic_operator;
            var cpf_logic_value;

            section_logic.section = this_section_id;
            section_logic.toggle = _toggle;
            section_logic.what = _what;
            section_logic.rules = [];

            rules.find(".tm-logic-wrapper").children(".tm-logic-rule").each(function (i, el) {

                el = $(el);
                $cpf_logic_element = el.find(".cpf-logic-element");
                cpf_logic_section = $cpf_logic_element.children("option:selected").attr("data-section");
                cpf_logic_element = $cpf_logic_element.val();
                cpf_logic_operator = el.find(".cpf-logic-operator").val();
                cpf_logic_value = el.find(".cpf-logic-value").val();

                if (!el.find(".cpf-logic-value").is("select")) {
                    cpf_logic_value = $.tmEPOAdmin.tm_escape(cpf_logic_value);
                }

                section_logic.rules.push({
                    "section": cpf_logic_section,
                    "element": cpf_logic_element,
                    "operator": cpf_logic_operator,
                    "value": cpf_logic_value
                });

            });

            return JSON.stringify(section_logic);

        },

        element_logic_get_JSON: function (s) {

            var rules = $(s).find(".builder-logic-div");
            var this_element_id = s.find(".tm-builder-element-uniqid").val();
            var element_logic = {};
            var _toggle = rules.find(".epo-rule-toggle").val();
            var _what = rules.find(".epo-rule-what").val();
            var $cpf_logic_element;
            var cpf_logic_section;
            var cpf_logic_element;
            var cpf_logic_operator;
            var cpf_logic_value;

            element_logic.element = this_element_id;
            element_logic.toggle = _toggle;
            element_logic.what = _what;
            element_logic.rules = [];

            rules.find(".tm-logic-wrapper").children(".tm-logic-rule").each(function (i, el) {

                el = $(el);
                $cpf_logic_element = el.find(".cpf-logic-element");
                cpf_logic_section = $cpf_logic_element.children("option:selected").attr("data-section");
                cpf_logic_element = $cpf_logic_element.val();
                cpf_logic_operator = el.find(".cpf-logic-operator").val();
                cpf_logic_value = el.find(".cpf-logic-value").val();

                element_logic.rules.push({
                    "section": cpf_logic_section,
                    "element": cpf_logic_element,
                    "operator": cpf_logic_operator,
                    "value": cpf_logic_value
                });

            });

            return JSON.stringify(element_logic);

        },

        cpf_add_rule: function (e) {

            var _last = $(this).closest(".tm-logic-rule");
            var _clone = _last.tcClone(true);

            e.preventDefault();
            if (_clone) {
                _last.after(_clone);
            }

        },

        cpf_delete_rule: function (e) {

            var element = $(this);
            var _wrapper = element.closest(".tm-logic-wrapper");

            e.preventDefault();
            element.trigger("hideTtooltip");

            if (_wrapper.children().length > 1) {
                element.closest(".tm-logic-rule").css({
                    margin: "0 auto"
                }).animate({
                    opacity: 0,
                    height: 0,
                    width: 0
                }, 300, function () {
                    $(this).remove();
                });
            }

        },

        builder_items_sortable_obj: {
            "start": {},
            "end": {}
        },

        section_logic_reindex: function () {

            var l = $.tmEPOAdmin.builder_items_sortable_obj;

            $(".builder_layout .builder_wrapper").each(function (i, el) {

                var obj = $(el).find(".section_elements");
                var section_eq = $(el).index();
                var copy_rules = [];
                var section_rules = $(obj).find(".tm-builder-clogic").val() || "null";
                var copy;

                section_rules = $.epoAPI.util.parseJSON(section_rules);

                if (!(section_rules && ("rules" in section_rules) && section_rules.rules.length > 0)) {

                    return true; // skip
                }

                // Element is dragged on this section
                if (l.end.section_eq === section_eq) {

                    // Getting here means that an element from another section
                    // is being dragged on this section
                    $.each(section_rules.rules, function (i, rule) {
                        copy = rule;
                        if (rule.element > l.start.element && rule.secion === l.start.section) {
                            copy.element = parseInt(copy.element, 10) - 1;
                            copy_rules[i] = $.tmEPOAdmin.validate_rule(copy, $(el));
                        }
                        else {
                            copy_rules[i] = $.tmEPOAdmin.validate_rule(copy, $(el));
                        }
                    });
                    copy_rules = $.tm_array_values(copy_rules);
                    if (copy_rules.length === 0) {
                        $(obj).find(".activate-sections-logic").val("").trigger("change.cpf");
                    }
                    section_rules.rules = copy_rules;
                    $(obj).find(".tm-builder-clogic").val(JSON.stringify(section_rules));

                    // Element is not dragged on this section
                } else {

                    // Getting here means that an element from another section
                    // is being dragged on another section that is not the current section
                    $.each(section_rules.rules, function (i, rule) {
                        copy = rule;
                        if (l.start.section !== "check") {
                            // Element is not changing sections
                            if (rule.section === l.start.section && rule.section === l.end.section) {
                                // Element belonging to a rule is being dragged
                                if (rule.element === l.start.element) {
                                    copy.section = l.end.section;
                                    copy.element = l.end.element;
                                }
                                // Element not belonging to a rule is being dragged
                                // and breaks the rule
                                else if (parseInt(rule.element,10) > parseInt(l.start.element,10) && parseInt(rule.element,10) <= parseInt(l.end.element,10)) {

                                    copy.element = parseInt(copy.element, 10) - 1;
                                }
                                else if (parseInt(rule.element,10) < parseInt(l.start.element,10) && parseInt(rule.element,10) >= parseInt(l.end.element,10)) {

                                    copy.element = parseInt(copy.element, 10) + 1;
                                }
                            }
                            // Element is getting dragged off this section
                            else if (rule.section === l.start.section && rule.section !== l.end.section) {
                                // Element belonging to a rule is being dragged
                                if (rule.element === l.start.element) {
                                    copy.section = l.end.section;
                                    copy.element = l.end.element;
                                }
                                // Element not belonging to a rule is being dragged
                                // and breaks the rule
                                else if (parseInt(rule.element,10) > parseInt(l.start.element,10)) {
                                    copy.element = parseInt(copy.element, 10) - 1;
                                }
                            }
                            // Element is getting dragged on this section
                            else if (rule.section !== l.start.section && rule.section === l.end.section) {
                                if (parseInt(rule.element,10) >= parseInt(l.end.element,10)) {
                                    copy.element = parseInt(copy.element, 10) + 1;
                                }
                            }
                        }
                        if (!(l.end.section === "delete" && copy.element === "delete")) {
                            copy_rules[i] = $.tmEPOAdmin.validate_rule(copy, $(el));
                        }
                    });
                    copy_rules = $.tm_array_values(copy_rules);
                    if (copy_rules.length === 0) {
                        $(obj).find(".activate-sections-logic").val("").trigger("change.cpf");
                    }
                    section_rules.rules = copy_rules;
                    $(obj).find(".tm-builder-clogic").val(JSON.stringify(section_rules));

                }
            });

        },

        element_logic_reindex: function () {

            var l = $.tmEPOAdmin.builder_items_sortable_obj;
            var copy;
            var obj;
            var copy_rules;
            var element_rules;

            $(".bitem").each(function (i, el) {

                obj = $(el).find(".builder_element_wrap");
                copy_rules = [];
                element_rules = $(obj).find(".tm-builder-clogic").val() || "null";

                element_rules = $.epoAPI.util.parseJSON(element_rules);

                if (!(element_rules && ("rules" in element_rules) && element_rules.rules.length > 0)) {

                    return true; // skip
                }

                $.each(element_rules.rules, function (i, rule) {

                    copy = rule;

                    if (l.start.section !== "check") {
                        // Element is not changing sections
                        if (rule.section === l.start.section && rule.section === l.end.section) {
                            // Element belonging to a rule is being dragged
                            if (rule.element === l.start.element) {
                                //copy.section=l.end.section;
                                copy.element = l.end.element;
                            }
                            // Element not belonging to a rule is being dragged
                            // and breaks the rule
                            else if (parseInt(rule.element,10) > parseInt(l.start.element,10) && parseInt(rule.element,10) <= parseInt(l.end.element,10)) {
                                copy.element = parseInt(copy.element, 10) - 1;
                            }
                            else if (parseInt(rule.element,10) < parseInt(l.start.element,10) && parseInt(rule.element,10) >= parseInt(l.end.element,10)) {
                                copy.element = parseInt(copy.element, 10) + 1;
                            }
                        }
                        // Element is getting dragged off its section
                        else if (rule.section === l.start.section && rule.section !== l.end.section) {
                            // Element belonging to a rule is being dragged
                            if (rule.element === l.start.element) {
                                copy.section = l.end.section;
                                copy.element = l.end.element;
                            }
                            // Element not belonging to a rule is being dragged
                            // and breaks the rule
                            else if (parseInt(rule.element, 10) > parseInt(l.start.element,10)) {
                                copy.element = parseInt(copy.element, 10) - 1;
                            }
                        }
                        // Element is getting dragged on this rule's section
                        else if (rule.section !== l.start.section && rule.section === l.end.section) {
                            if (parseInt(rule.element,10) >= parseInt(l.end.element,10)) {
                                copy.element = parseInt(copy.element, 10) + 1;
                            }
                        }
                    }
                    if (!(l.end.section === "delete" && copy.element === "delete")) {
                        copy_rules[i] = $.tmEPOAdmin.validate_rule(copy, $(el));
                    }

                });

                copy_rules = $.tm_array_values(copy_rules);
                if (copy_rules.length === 0) {
                    $(obj).find(".activate-element-logic").val("").trigger("change.cpf");
                }
                element_rules.rules = copy_rules;
                $(obj).find(".tm-builder-clogic").val(JSON.stringify(element_rules));

            });

        },

        validate_rule: function (rule, bitem) {

            var section;
            var element;
            var check;
            var tm_option_values;

            if (!globalVariationObject || !rule || typeof rule !== "object" || !("element" in rule) || !("operator" in rule) || !("section" in rule) || !("value" in rule)) {
                return [];//false wrong rule
            } else {
                section = $(".tm-builder-sections-uniqid[value='" + rule.section + "']").closest(".builder_wrapper");
                element = $(section).find(".bitem_wrapper").children(".bitem").not(".element_is_disabled").eq(rule.element);
                check = false;

                if ($(element).is(".element-radiobuttons,.element-checkboxes,.element-selectbox")) {

                    tm_option_values = $(element).find(".tm_option_value");

                    tm_option_values.each(function (index, value) {

                        if ($.tmEPOAdmin.tm_escape($(value).val()) === rule.value) {
                            check = true;
                            return false;
                        } else if ($(value).val() === rule.value) {
                            rule.value = $.tmEPOAdmin.tm_escape(rule.value);
                            check = true;
                            return false;
                        }
                    });

                } else if ($(element).is(".element-variations")) {
                    if (rule.operator === "is" || rule.operator === "isnot"){
                        $(globalVariationObject.variations).each(function (index, variation) {
                            if ($.tmEPOAdmin.tm_escape(variation.variation_id) === rule.value) {
                                check = true;
                                return false;
                            }                        
                        });
                    } else {
                        check = true;
                    }
                } else {
                    check = true;//other fields always true if they exist
                }

                if (check || $(bitem).find(".activate-element-logic").val() === "") {
                    $(bitem).removeClass("tm-wrong-rule");
                    return rule;
                } else {
                    $(bitem).addClass("tm-wrong-rule");
                    return [];//false
                }

            }

        },

        logic_reindex: function () {

            var l = $.tmEPOAdmin.builder_items_sortable_obj;

            if (!(l.start.section === l.end.section && l.start.section_eq === l.end.section_eq && l.start.element === l.end.element)) {
                $.tmEPOAdmin.section_logic_reindex();
                $.tmEPOAdmin.element_logic_reindex();
            }
            $.tmEPOAdmin.builder_items_sortable_obj = {"start": {}, "end": {}};

        },

        logic_reindex_force: function () {
            $.tmEPOAdmin.builder_items_sortable_obj.start.section = "check";
            $.tmEPOAdmin.builder_items_sortable_obj.start.section_eq = "check";
            $.tmEPOAdmin.builder_items_sortable_obj.start.element = "check";
            $.tmEPOAdmin.builder_items_sortable_obj.end.section = "check2";
            $.tmEPOAdmin.builder_items_sortable_obj.end.section_eq = "check2";
            $.tmEPOAdmin.builder_items_sortable_obj.end.element = "check2";

            $.tmEPOAdmin.section_logic_reindex();
            $.tmEPOAdmin.element_logic_reindex();
            $.tmEPOAdmin.builder_items_sortable_obj = {"start": {}, "end": {}};
        },

        is_element_dragged: false,

        // Elements sortable
        builder_items_sortable: function (obj) {

            if (!$.tmEPOAdmin.is_original) {
                return;
            }

            obj.sortable({
                "handle": ".move",
                "cursor": "move",
                "items": ".bitem",
                "start": function (e, ui) {

                    var builder_wrapper;
                    var is_slider;
                    var field_index;

                    ui.placeholder.height(ui.helper.outerHeight());
                    ui.placeholder.width(ui.helper.outerWidth());
                    $.tmEPOAdmin.is_element_dragged = true;
                    if (!$(ui.item).hasClass("ditem")) {
                        builder_wrapper = $(ui.item).closest(".builder_wrapper");
                        is_slider = builder_wrapper.is(".tm-slider-wizard");
                        field_index = $.tmEPOAdmin.find_index(is_slider, $(ui.item));
                        builder_wrapper.addClass("tm-zindex").css("zIndex", 3);
                        builder_wrapper.find(".tm_builder_sections").val(function (i, oldval) {
                            oldval = parseInt(oldval, 10) - 1;
                            return oldval;
                        });
                        builder_wrapper.find(".tm_builder_section_slides").val(function () {
                            if (!builder_wrapper.is(".tm-slider-wizard")) {
                                return "";
                            }
                            return builder_wrapper.find(".bitem_wrapper")
                            .map(function (i, e) {
                                return $(e).children(".bitem").not(".pl2, .element_is_disabled").length;
                            }).get().join(",");
                        });
                        $.tmEPOAdmin.builder_items_sortable_obj.start.section = builder_wrapper.find(".tm-builder-sections-uniqid").val();
                        $.tmEPOAdmin.builder_items_sortable_obj.start.section_eq = builder_wrapper.index().toString();
                        $.tmEPOAdmin.builder_items_sortable_obj.start.element = field_index.toString();
                    } else {
                        $.tmEPOAdmin.builder_items_sortable_obj.start.section = "drag";
                        $.tmEPOAdmin.builder_items_sortable_obj.start.section_eq = "drag";
                        $.tmEPOAdmin.builder_items_sortable_obj.start.element = "drag";
                    }

                    $(".builder_layout .bitem_wrapper").not(".tma-variations-wrap .bitem_wrapper").addClass("highlight");

                },
                "stop": function (e, ui) {

                    var builder_wrapper;
                    var is_slider;
                    var field_index;

                    $.tmEPOAdmin.is_element_dragged = false;
                    builder_wrapper = $(ui.item).closest(".builder_wrapper");
                    is_slider = builder_wrapper.is(".tm-slider-wizard");
                    field_index = $.tmEPOAdmin.find_index(is_slider, $(ui.item));
                    if (!$(ui.item).hasClass("ditem")) {
                        $(".builder_wrapper.tm-zindex").css("zIndex", "").removeClass("tm-zindex");
                        builder_wrapper.find(".tm_builder_sections").val(function (i, oldval) {
                            oldval = parseInt(oldval, 10) + 1;
                            return oldval;
                        });
                        builder_wrapper.find(".tm_builder_section_slides").val(function () {
                            if (!builder_wrapper.is(".tm-slider-wizard")) {
                                return "";
                            }
                            return builder_wrapper.find(".bitem_wrapper")
                            .map(function (i, e) {
                                return $(e).children(".bitem").not(".pl2, .element_is_disabled").length;
                            }).get().join(",");
                        });
                    }
                    $.tmEPOAdmin.builder_items_sortable_obj.end.section = builder_wrapper.find(".tm-builder-sections-uniqid").val();
                    $.tmEPOAdmin.builder_items_sortable_obj.end.section_eq = builder_wrapper.index().toString();
                    $.tmEPOAdmin.builder_items_sortable_obj.end.element = field_index.toString();

                    $.tmEPOAdmin.builder_reorder_multiple();
                    if ($(ui.item).hasClass("ditem")) {
                        ui.draggable = ui.item;
                        $.tmEPOAdmin.drag_drop(e, ui, $(this));
                    }
                    $.tmEPOAdmin.logic_reindex();
                    $(".builder_layout .bitem_wrapper").removeClass("highlight");

                },
                "tolerance": "pointer",
                "forcePlaceholderSize": true,
                "placeholder": "bitem pl2",

                "forceHelperSize": true,
                "helper": "clone",

                "cancel": ".panels_wrap,.tma-nomove",
                "dropOnEmptyType": true,
                "revert": 200,
                "connectWith": ".builder_wrapper:not(.tma-nomove) .bitem_wrapper"
            });

        },

        // Element delete button
        builder_delete_onClick: function () {

            var builder_wrapper;
            var _bitem;
            var is_slider;
            var field_index;

            if (confirm(TMEPOGLOBALADMINJS.i18n_builder_delete)) {
                builder_wrapper = $(this).closest(".builder_wrapper");
                _bitem = $(this).closest(".bitem");
                is_slider = builder_wrapper.is(".tm-slider-wizard");
                field_index = $.tmEPOAdmin.find_index(is_slider, _bitem);
                builder_wrapper.find(".tm_builder_sections").val(function (i, oldval) {
                    oldval = parseInt(oldval, 10) - 1;
                    return oldval;
                });

                $.tmEPOAdmin.builder_items_sortable_obj.start.section = builder_wrapper.find(".tm-builder-sections-uniqid").val();
                $.tmEPOAdmin.builder_items_sortable_obj.start.section_eq = builder_wrapper.index().toString();
                $.tmEPOAdmin.builder_items_sortable_obj.start.element = field_index.toString();

                $.tmEPOAdmin.builder_items_sortable_obj.end.section = "delete";
                $.tmEPOAdmin.builder_items_sortable_obj.end.section_eq = "delete";
                $.tmEPOAdmin.builder_items_sortable_obj.end.element = "delete";
                $(this).closest(".bitem").remove();
                $.tmEPOAdmin.logic_reindex();

                builder_wrapper.find(".tm_builder_section_slides").val(function () {
                    if (!builder_wrapper.is(".tm-slider-wizard")) {
                        return "";
                    }
                    return builder_wrapper.find(".bitem_wrapper")
                    .map(function (i, e) {
                        return $(e).children(".bitem").not(".pl2, .element_is_disabled").length;
                    }).get().join(",");
                });

                $.tmEPOAdmin.builder_reorder_multiple();
            }

        },

        builder_fold_onClick: function () {

            var $this = $(this);
            var handle_wrap;
            var handle_wrapper;

            if ($this.is(".tma-handle")) {
                $this = $this.find(".fold");
            }
            handle_wrap = $this.closest(".tma-handle-wrap");
            handle_wrapper = handle_wrap.find(".tma-handle-wrapper").first();
            if (!$this.data("folded") && $this.data("folded") !== undefined) {
                $this.data("folded", true);
                $this.removeClass("tcfa-caret-down").addClass("tcfa-caret-up");
                handle_wrapper.addClass("tm-hidden");
            } else {
                $this.data("folded", false);
                $this.removeClass("tcfa-caret-up").addClass("tcfa-caret-down");
                handle_wrapper.removeClass("tm-hidden");
            }

        },

        builder_section_fold_onClick: function () {

            var builder_wrapper = $(this).closest(".builder_wrapper");

            if (!$(this).data("folded")) {
                $(this).data("folded", true);
                builder_wrapper.addClass("tm-hide-bitems");//hide
                $(this).removeClass("tcfa-caret-down").addClass("tcfa-caret-up");
            } else {
                $(this).data("folded", false);
                builder_wrapper.removeClass("tm-hide-bitems");//show
                $(this).removeClass("tcfa-caret-up").addClass("tcfa-caret-down");
            }

            $(this).closest(".builder_wrapper").find(".float.builder_drag_elements").remove();

        },

        // Section delete button
        builder_section_delete_onClick: function () {
            if (confirm(TMEPOGLOBALADMINJS.i18n_builder_delete)) {
                $(this).closest(".builder_wrapper").remove();
                $.tmEPOAdmin.builder_reorder_multiple();
                $(".builder_layout .builder_wrapper").each(function (i, el) {
                    $.tmEPOAdmin.logic_init($(el));
                });
                $.tmEPOAdmin.init_sections_check();
                $.tmEPOAdmin.fix_content_float();
                if ($(this).closest(".builder_wrapper").is(".tma-variations-wrap")) {
                    $.tmEPOAdmin.toggle_variation_button();
                    $.tmEPOAdmin.var_remove("tm-style-variation-added");
                }
            }
        },

        // Element plus button
        builder_plus_onClick: function () {

            var s = $.tmEPOAdmin.builder_size();
            var current_size = $(this).parentsUntil(".bitem").parent().first();
            var x;

            for (x in s) {
                if (current_size.hasClass(s[x][0])) {
                    if (x < 5) {
                        current_size.removeClass("" + s[x][0]);
                        current_size.addClass("" + s[parseInt(parseInt(x, 10) + 1, 10)][0]);
                        current_size.find(".size").text(s[parseInt(parseInt(x, 10) + 1, 10)][1]);
                        current_size.find(".div_size").val(s[parseInt(parseInt(x, 10) + 1, 10)][0]);
                    }
                    break;
                }
            }

        },

        // Element minus button
        builder_minus_onClick: function () {

            var s = $.tmEPOAdmin.builder_size();
            var current_size = $(this).parentsUntil(".bitem").parent().first();
            var x;

            for (x in s) {
                if (current_size.hasClass(s[x][0])) {
                    if (x > 0) {
                        current_size.removeClass("" + s[x][0]);
                        current_size.addClass("" + s[parseInt(parseInt(x, 10) - 1, 10)][0]);
                        current_size.find(".size").text(s[parseInt(parseInt(x, 10) - 1, 10)][1]);
                        current_size.find(".div_size").val(s[parseInt(parseInt(x, 10) - 1, 10)][0]);
                    }
                    break;
                }
            }

        },

        // Section plus button
        builder_section_plus_onClick: function () {

            var s = $.tmEPOAdmin.builder_size();
            var current_size = $(this).closest(".builder_wrapper");
            var x;

            for (x in s) {
                if (current_size.hasClass(s[x][0])) {
                    if (x < 5) {
                        current_size.removeClass("" + s[x][0]);
                        current_size.addClass("" + s[parseInt(parseInt(x, 10) + 1, 10)][0]);
                        current_size.find(".btitle .size").text(s[parseInt(parseInt(x, 10) + 1, 10)][1]);
                        current_size.find(".tm_builder_sections_size").val(s[parseInt(parseInt(x, 10) + 1, 10)][0]);
                    }
                    break;
                }
            }

        },

        // Section minus button
        builder_section_minus_onClick: function () {

            var s = $.tmEPOAdmin.builder_size();
            var current_size = $(this).closest(".builder_wrapper");
            var x;

            for (x in s) {
                if (current_size.hasClass(s[x][0])) {
                    if (x > 0) {
                        current_size.removeClass("" + s[x][0]);
                        current_size.addClass("" + s[parseInt(parseInt(x, 10) - 1, 10)][0]);
                        current_size.find(".btitle .size").text(s[parseInt(parseInt(x, 10) - 1, 10)][1]);
                        current_size.find(".tm_builder_sections_size").val(s[parseInt(parseInt(x, 10) - 1, 10)][0]);
                    }
                    break;
                }
            }

        },

        // Section edit button
        builder_section_item_onClick: function () {

            var _bs = $(this).closest(".builder_wrapper");
            var _current_logic;
            var _s;
            var _st;
            var _c;
            var $_html;
            var clicked;

            $.tmEPOAdmin.check_section_logic(_bs);
            _current_logic = $.tmEPOAdmin.logic_object;
            $.tmEPOAdmin.logic_init(_bs);
            _s = $(this).closest(".builder_wrapper").find(".section_elements");

            _st = _s.find(".tm-tabs");
            if (!_st.data("tm-has-tmtabs")) {
                _st.tmtabs();
            }
            _c = _s.tcClone();
            $.tmEPOAdmin.gen_events(_bs);
            $_html = $.tmEPOAdmin.builder_floatbox_template({
                "id": "temp_for_floatbox_insert",
                "html": "",
                "title": TMEPOGLOBALADMINJS.i18n_edit_settings,
                "uniqid": TMEPOGLOBALADMINJS.i18n_section_uniqid + ":" + _s.find(".tm-builder-sections-uniqid").val()
            });

            $.tcFloatBox({
                "closefadeouttime": 0,
                "animateOut": "",
                "fps": 1,
                "ismodal": true,
                "refresh": "fixed",
                "width": "80%",
                "height": "80%",
                "classname": "flasho tm_wrapper" + (_bs.is(".tma-variations-wrap") ? " tma-variations-section" : ""),
                "data": $_html,
                "cancelEvent": function (inst) {
                    if (clicked) {
                        return;
                    }
                    clicked = true;
                    $.tmEPOAdmin.logic_object = _current_logic;
                    $.tmEPOAdmin.removeTinyMCE(".flasho.tm_wrapper");
                    _c.prependTo(_bs).addClass("closed");
                    $.tmEPOAdmin.builder_clone_after_events(_c);
                    inst.destroy();
                },
                "cancelClass": ".floatbox-cancel",
                "updateEvent": function (inst) {
                    if (clicked) {
                        return;
                    }
                    clicked = true;
                    $.tmEPOAdmin.removeTinyMCE(".flasho.tm_wrapper");
                    _s.find(".tm-builder-clogic").val($.tmEPOAdmin.logic_get_JSON(_s));
                    _s.prependTo(_bs).addClass("closed");
                    $.tmEPOAdmin.builder_clone_after_events(_s);
                    _bs.trigger("sections_type_onChange.cpf");
                    $.tmEPOAdmin.logic_reindex_force();
                    inst.destroy();
                },
                "updateClass": ".floatbox-update"
            });
            clicked = false;

            _s.appendTo("#temp_for_floatbox_insert").removeClass("closed");
            _s.find(".sections_style").trigger("change.cpf");
            $.tmEPOAdmin.addTinyMCE(".flasho.tm_wrapper");

        },

        // Element edit button
        builder_item_onClick: function () {

            var bitem = $(this).closest(".bitem");
            var bitemt = bitem.find(".tm-tabs");
            var _current_logic;
            var _bs;
            var _s;
            var _c;
            var original_enabled;
            var $_html;
            var clicked;
            var pager;

            if (!bitemt.data("tm-has-tmtabs")) {
                bitemt.tmtabs();
            }
            $.tmEPOAdmin.panels_sortable(bitem.find(".panels_wrap"));

            $.tmEPOAdmin.check_element_logic(bitem);
            _current_logic = $.tmEPOAdmin.element_logic_object;
            $.tmEPOAdmin.element_logic_init(bitem);
            _bs = $(this).closest(".hstc2");
            _s = $(this).closest(".hstc2").find(".inside:first");
            _c = _s.tcClone();
            original_enabled = _s.find(".is_enabled").val();
            $.tmEPOAdmin.gen_events(bitem);
            $_html = $.tmEPOAdmin.builder_floatbox_template({
                "id": "temp_for_floatbox_insert",
                "html": "",
                "title": TMEPOGLOBALADMINJS.i18n_edit_settings,
                "uniqid": (bitem.is(".element-variations") || bitem.find(".tm-builder-element-uniqid").length === 0) ? "" : TMEPOGLOBALADMINJS.i18n_element_uniqid + ":" + bitem.find(".tm-builder-element-uniqid").val()
            });

            $.tcFloatBox({
                "closefadeouttime": 0,
                "animateOut": "",
                "fps": 1,
                "ismodal": true,
                "refresh": "fixed",
                "width": "80%",
                "height": "80%",
                "classname": "flasho tm_wrapper" + (_bs.is(".tma-variations-wrap") ? " tma-variations-section" : ""),
                "data": $_html,
                "cancelEvent": function (inst) {
                    if (clicked) {
                        return;
                    }
                    clicked = true;

                    pager = _c.find(".tcpagination");
                    if (pager.data("tc-pagination")) {
                        pager.tcPagination("destroy");
                    }

                    $.tmEPOAdmin.element_logic_object = _current_logic;
                    $.tmEPOAdmin.removeTinyMCE(".flasho.tm_wrapper");
                    _c.appendTo(_bs);
                    _c = _c.parentsUntil(".bitem").parent();
                    $.tmEPOAdmin.builder_clone_after_events(_c);

                    inst.destroy();
                },
                "cancelClass": ".floatbox-cancel",
                "updateEvent": function (inst) {
                    var new_enabled;
                    var section;
                    var sections;
                    var section_id;
                    var is_slider;
                    var true_field_index;
                    var new_field_index;
                    var rules;
                    var section_elements;
                    var section_rules;

                    if (clicked) {
                        return;
                    }
                    clicked = true;
                    pager = _s.find(".tcpagination");
                    if (pager.data("tc-pagination")) {
                        pager.tcPagination("destroy");
                    }
                    $.tmEPOAdmin.removeTinyMCE(".flasho.tm_wrapper");
                    _s.find(".tm-builder-clogic").val($.tmEPOAdmin.element_logic_get_JSON(_s));
                    _s.appendTo(_bs);

                    $.tmEPOAdmin.builder_clone_after_events(_s);
                    _s.find(".tm-header-title").trigger("changetitle.cpf");
                    $.tmEPOAdmin.logic_reindex_force();

                    if (_s.find(".is_enabled").val() === "0") {
                        bitem.addClass("element_is_disabled");
                    } else {
                        bitem.removeClass("element_is_disabled");
                    }
                    new_enabled = _s.find(".is_enabled").val();

                    if (original_enabled !== new_enabled) {

                        section = bitem.closest(".builder_wrapper");
                        sections = $(".builder_layout .builder_wrapper").not(section);
                        section_id = section.find(".tm-builder-sections-uniqid").val();
                        is_slider = section.is(".tm-slider-wizard");
                        true_field_index = $.tmEPOAdmin.find_index(is_slider, bitem);
                        new_field_index = $.tmEPOAdmin.find_index(is_slider, bitem, ".bitem", ".element_is_disabled");

                        section.find(".bitem").not(bitem).each(function (i, el) {
                            el = $(el);
                            rules = el.find(".tm-builder-clogic").val() || "null";
                            rules = $.epoAPI.util.parseJSON(rules);
                            rules = $.tmEPOAdmin.logic_check_rules_reindex(el, rules, true_field_index, new_field_index, section_id, new_enabled);
                            el.find(".tm-builder-clogic").val(JSON.stringify(rules));
                        });

                        // needs check if element in rule is from the section above, otherwise no need to checnge the rule.
                        sections.each(function (i0, el) {
                            el = $(el);
                            section_elements = el.find(".section_elements");
                            section_rules = section_elements.find(".tm-builder-clogic").val() || "null";
                            section_rules = $.epoAPI.util.parseJSON(section_rules);
                            section_rules = $.tmEPOAdmin.logic_check_rules_reindex(el, section_rules, true_field_index, new_field_index, section_id, new_enabled);
                            section_elements.find(".tm-builder-clogic").val(JSON.stringify(section_rules));
                            el.find(".bitem").not(bitem).each(function (i2, bel) {
                                bel = $(bel);
                                rules = bel.find(".tm-builder-clogic").val() || "null";
                                rules = $.epoAPI.util.parseJSON(rules);
                                rules = $.tmEPOAdmin.logic_check_rules_reindex(el, rules, true_field_index, new_field_index, section_id, new_enabled);
                                bel.find(".tm-builder-clogic").val(JSON.stringify(rules));
                            });
                        });

                    }
                    inst.destroy();
                },
                "updateClass": ".floatbox-update"
            });
            clicked = false;

            _s.appendTo("#temp_for_floatbox_insert");
            if (bitem.is(".element-variations")) {
                $.tmEPOAdmin.variations_display_as();
            } else {
                $.tmEPOAdmin.tm_upload();
            }

            $("#temp_for_floatbox_insert").find(".tm_select_price_type").trigger("change.cpf");
            $.tcToolTip($("#temp_for_floatbox_insert").find(".tm-tooltip"));
            $.tmEPOAdmin.tm_weekdays($("#temp_for_floatbox_insert"));
            $.tmEPOAdmin.tm_url();
            $.tmEPOAdmin.selectbox_price_type();
            $.tmEPOAdmin.tm_qty_selector();
            $.tmEPOAdmin.tm_pricetype_selector();
            $.tmEPOAdmin.addTinyMCE(".flasho.tm_wrapper");
            $.tmEPOAdmin.paginattion_init();

        },

        logic_check_rules_reindex: function (el, rules, true_field_index, new_field_index, section_id, new_enabled) {

            var copy;

            if (typeof rules !== "object" || rules === null) {
                rules = {};
            }
            if (!("toggle" in rules)) {
                rules.toggle = "show";
            }
            if (!("what" in rules)) {
                rules.what = "any";
            }
            if (!("rules" in rules)) {
                rules.rules = [];
            }

            copy = rules;

            true_field_index = parseInt(true_field_index, 10);
            new_field_index = parseInt(new_field_index, 10);
            new_enabled = parseInt(new_enabled, 10);

            $.each(rules.rules, function (i, _rule) {

                var section = _rule.section;
                var element = _rule.element;

                if (section === section_id && element.toString().isNumeric()) {
                    element = parseInt(element, 10);
                    if (true_field_index === element) {

                        if (new_enabled === 0) {
                            delete copy.rules[i];
                            el.addClass("tm-wrong-rule");
                        }
                        else if (new_enabled === 1) {
                            element += 1;
                            copy.rules[i].element = element.toString();
                        }

                    } else if (true_field_index < element) {

                        if (new_enabled === 0) {
                            element -= 1;
                            copy.rules[i].element = element.toString();
                        }
                        else if (new_enabled === 1) {
                            element += 1;
                            copy.rules[i].element = element.toString();
                        }

                    }
                }

            });

            copy.rules = $.tm_array_values(copy.rules);

            return copy;

        },

        // Add Element draggable to sortable
        drag_drop: function (event, ui, dropable) {

            var selected_element = $(ui.draggable).attr("class").split(/\s+/).filter(function (item) {
                return item.indexOf("element-") === -1 ? "" : item.indexOf("-element-") === -1 ? item : "";
            }).toString();

            selected_element = selected_element.replace(/element-/gi, "");
            if (selected_element) {
                $.tmEPOAdmin.builder_clone_element(selected_element, dropable.closest(".builder_wrapper"));
            }

        },

        // Add Element to sortable via Add button
        builder_clone_element: function (element, wrapper_selector, append_or_prepend) {

            var _template = $.epoAPI.template.html(templateEngine.tc_builder_elements, {});
            var _clone;
            var is_slider;
            var field_index;

            if (!_template) {
                return;
            }
            if (!append_or_prepend) {
                append_or_prepend = "append";
            }
            wrapper_selector = $(wrapper_selector);
            _clone = $(_template).filter(".bitem.element-" + element).tcClone(true);
            if (_clone) {
                _clone.find(".tm-builder-element-uniqid").val($.tm_uniqid("", true));
                if ($(".builder_wrapper").length <= 0) {
                    $.tmEPOAdmin.builder_add_section_onClick();
                }
                _clone.addClass("appear");
                $.tmEPOAdmin.set_field_title(_clone);
                if (wrapper_selector.find(".bitem_wrapper").find(".ditem").length > 0) {
                    wrapper_selector.find(".bitem_wrapper").find(".ditem").replaceWith(_clone);
                } else {
                    if (append_or_prepend === "append") {
                        wrapper_selector.find(".bitem_wrapper").not(".tm-hide").append(_clone);
                    }
                    if (append_or_prepend === "prepend") {
                        wrapper_selector.find(".bitem_wrapper").not(".tm-hide").prepend(_clone);
                    }

                }
                wrapper_selector.find(".tm_builder_sections").val(function (i, oldval) {
                    oldval = parseInt(oldval, 10) + 1;
                    return oldval;
                });
                wrapper_selector.find(".tm_builder_section_slides").val(function () {
                    if (!wrapper_selector.is(".tm-slider-wizard")) {
                        return "";
                    }
                    return wrapper_selector.find(".bitem_wrapper")
                    .map(function (i, e) {
                        return $(e).children(".bitem").not(".pl2, .element_is_disabled").length;
                    }).get().join(",");
                });
                _clone.find(".tm-tabs").tmtabs();
                _clone.find(".tm-header-title").data("id", _clone);
                $.tmEPOAdmin.panels_sortable(_clone.find(".panels_wrap"));

                if (append_or_prepend === "prepend" || append_or_prepend === "append") {
                    is_slider = wrapper_selector.is(".tm-slider-wizard");
                    field_index = $.tmEPOAdmin.find_index(is_slider, _clone);

                    $.tmEPOAdmin.builder_items_sortable_obj.start.section = "drag";
                    $.tmEPOAdmin.builder_items_sortable_obj.start.section_eq = "drag";
                    $.tmEPOAdmin.builder_items_sortable_obj.start.element = "drag";

                    $.tmEPOAdmin.builder_items_sortable_obj.end.section = wrapper_selector.find(".tm-builder-sections-uniqid").val();
                    $.tmEPOAdmin.builder_items_sortable_obj.end.section_eq = wrapper_selector.index().toString();
                    $.tmEPOAdmin.builder_items_sortable_obj.end.element = field_index.toString();
                }

                $.tmEPOAdmin.check_element_logic(_clone);
                $.tmEPOAdmin.builder_reorder_multiple();
                return _clone;
            }

        },

        // Element clone button
        builder_clone_onClick: function (e) {

            var _bitem;
            var _label_data;
            var _clone;
            var is_slider;
            var field_index;

            e.preventDefault();
            if (!confirm(TMEPOGLOBALADMINJS.i18n_builder_clone)) {
                return;
            }
            _bitem = $(this).closest(".bitem");
            _label_data = _bitem.data("original_title");
            _clone = _bitem.tcClone();
            _clone.data("original_title", _label_data);

            if (_clone) {

                _bitem.after(_clone);
                is_slider = _clone.closest(".builder_wrapper").is(".tm-slider-wizard");
                field_index = $.tmEPOAdmin.find_index(is_slider, _clone);

                _clone.closest(".builder_wrapper").find(".tm_builder_sections").val(function (i, oldval) {
                    oldval = parseInt(oldval, 10) + 1;
                    return oldval;
                });
                _clone.closest(".builder_wrapper").find(".tm_builder_section_slides").val(function () {
                    if (!_clone.closest(".builder_wrapper").is(".tm-slider-wizard")) {
                        return "";
                    }
                    return _clone.closest(".builder_wrapper").find(".bitem_wrapper")
                    .map(function (i, e) {
                        return $(e).children(".bitem").not(".pl2, .element_is_disabled").length;
                    }).get().join(",");
                });
                _clone.find(".tm-header-title").data("id", _clone);
                _clone.find(".tm-builder-element-uniqid").val($.tm_uniqid("", true));
                _clone.find(".tcpagination").tcPagination("destroy");
                $.tmEPOAdmin.builder_clone_after_events(_clone);
                $.tmEPOAdmin.builder_reorder_multiple();
                $.tmEPOAdmin.builder_items_sortable_obj.start.section = "clone";
                $.tmEPOAdmin.builder_items_sortable_obj.start.section_eq = "clone";
                $.tmEPOAdmin.builder_items_sortable_obj.start.element = "clone";
                $.tmEPOAdmin.builder_items_sortable_obj.end.section = _bitem.closest(".builder_wrapper").find(".tm-builder-sections-uniqid").val();
                $.tmEPOAdmin.builder_items_sortable_obj.end.section_eq = _bitem.closest(".builder_wrapper").index().toString();
                $.tmEPOAdmin.builder_items_sortable_obj.end.element = field_index.toString();
                $.tmEPOAdmin.logic_reindex();
            }

        },

        // Section clone button
        builder_section_clone_onClick: function (e) {

            var _bitem;
            var _clone;
            var original_titles;
            var style;

            e.preventDefault();
            if (!confirm(TMEPOGLOBALADMINJS.i18n_builder_clone)) {
                return;
            }
            _bitem = $(this).closest(".builder_wrapper");
            _clone = _bitem.tcClone();
            if (_clone) {
                _clone.find(".tm-builder-sections-uniqid").val($.tm_uniqid("", true));
                original_titles = [];
                _bitem.find(".bitem").each(function (i, el) {
                    original_titles[i] = $(el).data("original_title");
                });
                _bitem.after(_clone);
                _clone.find(".bitem").each(function (i, el) {
                    $(el).data("original_title", original_titles[i]);
                    $(el).find(".tm-header-title").data("id", $(el));
                });

                style = _clone.find(".section_elements .sections_type").val();

                if (style === "slider") {
                    $.tmEPOAdmin.create_slider(_clone);
                }

                $.tmEPOAdmin.builder_reorder_multiple();
                $.tmEPOAdmin.builder_items_sortable(_clone.find(".bitem_wrapper"));
                $.tmEPOAdmin.builder_clone_after_events(_clone);
                _clone.find(".tm-builder-sections-uniqid").val($.tm_uniqid("", true));
                $.tmEPOAdmin.check_section_logic(_clone);
                $.tmEPOAdmin.check_element_logic();
                $.tmEPOAdmin.logic_init(_clone);
                _clone.addClass("appear");
            }

        },

        // Helper : Holds element and sections available sizes
        builder_size: function () {

            var s = [];

            s[0] = ["w25", "1/4"];
            s[1] = ["w33", "1/3"];
            s[2] = ["w50", "1/2"];
            s[3] = ["w66", "2/3"];
            s[4] = ["w75", "3/4"];
            s[5] = ["w100", "1/1"];

            return s;

        },

        // Helper : Creates the html for the edit pop up
        builder_floatbox_template: function (data) {

            return $.epoAPI.template.html(wp.template("tc-floatbox"), {
                "id": data.id,
                "title": data.title,
                "html": data.html,
                "uniqid": data.uniqid,
                "update": TMEPOGLOBALADMINJS.i18n_update,
                "cancel": TMEPOGLOBALADMINJS.i18n_cancel
            });

        },

        builder_floatbox_template_import: function (data) {

            return $.epoAPI.template.html(wp.template("tc-floatbox-import"), {
                "id": data.id,
                "title": data.title,
                "html": data.html,
                "cancel": TMEPOGLOBALADMINJS.i18n_cancel
            });

        },

        id_array: {},

        _nameAndPropChange: function (element, i) {

            var _m = $(element).attr("name");
            var __m = /\[[0-9]+\]\[\]/g;
            var __m2 = /\[[0-9]+\]/g;
            var _name;
            var _check;

            if (_m.match(__m) !== null) {
                _m = _m.replace(__m, "[" + i + "][]");
            } else {
                if (_m.match(__m2) !== null) {
                    _m = _m.replace(__m2, "[" + i + "]");
                }
            }
            _name = _m.replace(/[\[\]]/g, "");
            if (_name in $.tmEPOAdmin.id_array) {
                $.tmEPOAdmin.id_array[_name] = parseInt($.tmEPOAdmin.id_array[_name], 10) + 1;
            } else {
                $.tmEPOAdmin.id_array[_name] = 0;
            }
            _check = false;
            if ($(element).is(":radio:checked")) {
                _check = true;
            }
            _m = _m + "_temp";
            $(element).attr("name", _m);
            if (_check) {
                $(element).attr("checked", "checked").prop("checked", true);
            } else {
                $(element).removeAttr("checked").prop("checked", false);
            }

        },
        _idChange: function (el, i) {

            var _m = $(el).attr("name");
            var __m = /\[[0-9]+\]\[\]/g;
            var __m2 = /\[[0-9]+\]/g;
            var _name;

            if (_m.match(__m) !== null) {
                _m = _m.replace(__m, "[" + i + "][]");
            } else {
                if (_m.match(__m2) !== null) {
                    _m = _m.replace(__m2, "[" + i + "]");
                }
            }
            _name = _m.replace(/[\[\]]/g, "");
            if (_name in $.tmEPOAdmin.id_array) {
                $.tmEPOAdmin.id_array[_name] = parseInt($.tmEPOAdmin.id_array[_name], 10) + 1;
            } else {
                $.tmEPOAdmin.id_array[_name] = 0;
            }
            $(el).attr("id", _name + "_" + $.tmEPOAdmin.id_array[_name]);

            return _m;

        },
        _idChange2: function (el) {

            var _name = $(el).attr("name").replace(/[\[\]]/g, "");

            if (_name in $.tmEPOAdmin.id_array) {
                $.tmEPOAdmin.id_array[_name] = parseInt($.tmEPOAdmin.id_array[_name], 10) + 1;
            } else {
                $.tmEPOAdmin.id_array[_name] = 0;
            }
            $(el).attr("id", _name + $.tmEPOAdmin.id_array[_name]);
        },

        // Helper : Renames all fields that contain multiple options
        builder_reorder_multiple: function () {

            var obj;
            var inputArray = $(".builder_layout").find("[name^=\"tm_meta\\[tmfbuilder\\]\\[multiple_\"]").map(function () {
                return $(this).closest(".bitem").attr("class").split(" ")
                .map(function (cls) {
                    if (cls.indexOf("element-", 0) !== -1) {
                        return cls;
                    }
                })
                .filter(function (v) {
                    if (v !== null && v !== undefined) {
                        return v;
                    }
                });
            }).toArray();
            var outputArray = [];
            var ia;

            for (ia = 0; ia < inputArray.length; ia += 1) {
                if (($.inArray(inputArray[ia], outputArray)) === -1) {
                    outputArray.push(inputArray[ia]);
                }
            }
            $.tmEPOAdmin.id_array = {};

            outputArray.forEach(function (selector) {
                obj = $(".builder_layout ." + selector);
                obj.toArray().forEach(function (el, i) {
                    $(el).find(".tm-default-radio").toArray().forEach(function (radio) {
                        $.tmEPOAdmin._nameAndPropChange(radio, i);
                    });
                    $(el).find("[name]").not(".tm-default-radio").toArray().forEach(function (element) {
                        $(element).attr("name", $.tmEPOAdmin._idChange(element, i));
                    });
                });
            });

            // Preserving checked radios
            $(".builder_layout").find(".tm-default-radio").each(function (index, element) {
                var _n = $(element).attr("name");
                _n = _n.replace(/_temp/g, "");
                $(this).attr("name", _n);
            });

            obj = $(".builder_layout").find("[name]").not("[name^=\"tm_meta\\[tmfbuilder\\]\\[multiple_\"]");
            obj.toArray().forEach(function (el) {
                $.tmEPOAdmin._idChange2(el);
            });

        },

        // Helper : Generates new events after cloning an element
        builder_clone_after_events: function (_clone) {
            _clone.find("input.tm-color-picker").spectrum("destroy");
            _clone.find(".sp-replacer").remove();
            $.tmEPOAdmin.panels_sortable(_clone.find(".panels_wrap"));
            _clone.find(".tm-tabs").tmtabs();
        },

        // Helper : Generates general events
        gen_events: function (obj) {
            if (!obj) {
                obj = $(".builder_layout ");
            }
            obj.find("input.tm-color-picker").spectrum({
                showInput: true,
                showInitial: true,
                allowEmpty: true,
                showAlpha: false,
                showPalette: false,
                clickoutFiresChange: true,
                showButtons: false,
                preferredFormat: "hex"
            });
        },

        paginattion_init: function (start) {

            var obj = $("#temp_for_floatbox_insert");
            var pager = obj.find(".tcpagination");
            var panels_wrap;
            var options_wrap;
            var perpage;
            var total;

            if (pager.length === 0) {
                return;
            }
            panels_wrap = obj.find(".panels_wrap");
            options_wrap = panels_wrap.find(".options_wrap");
            perpage = parseInt(pager.attr("data-perpage"), 10);
            total = Math.ceil(options_wrap.length / perpage);

            if (pager.data("tc-pagination")) {
                pager.tcPagination("destroy");
            }

            if (start === "last") {
                start = total;
            } else if (start === "current") {
                start = pager.data("pagination_current") || 1;
            } else {
                start = 1;
            }

            pager.data("pagination_current", start);
            pager.tcPagination({
                totalPages: total,
                startPage: start,
                visiblePages: 10,
                onPageClick: function (event, page) {
                    $.tmEPOAdmin.paginationOnClick(pager, page, perpage, options_wrap);
                }
            });

        },

        paginationOnClick: function (pager, page, perpage, options_wrap) {

            var i;

            page = parseInt(page, 10);
            pager.data("pagination_current", page);
            options_wrap.addClass("tm-hidden");
            for (i = (perpage * page) - 1; i >= (perpage * (page - 1)); i -= 1) {
                options_wrap.eq(i).removeClass("tm-hidden");
            }

        },

        addTinyMCE: function (element) {

            var getter_tmce = "excerpt";
            var tmc_defaults = {
                theme: "modern",
                menubar: false,
                wpautop: true,
                indent: false,
                toolbar1: "bold,italic,underline,blockquote,strikethrough,bullist,numlist,alignleft,aligncenter,alignright,undo,redo,link,unlink",
                plugins: "fullscreen,image,wordpress,wpeditimage,wplink"
            };
            var qt_defaults = {
                buttons: "strong,em,link,block,del,ins,img,ul,ol,li,code,more,close,fullscreen"
            };
            var init_settings = ((typeof tinyMCEPreInit === "object") && ("mceInit" in tinyMCEPreInit) && (getter_tmce in tinyMCEPreInit.mceInit)) ? tinyMCEPreInit.mceInit[getter_tmce] : tmc_defaults;
            var qt_settings = ((typeof tinyMCEPreInit === "object") && ("qtInit" in tinyMCEPreInit) && (getter_tmce in tinyMCEPreInit.qtInit)) ? tinyMCEPreInit.qtInit[getter_tmce] : qt_defaults;
            var tmc_settings;
            var id;
            var tqt_settings;
            var editor_tools_html;
            var editor_tools_class;

            if (!$(element) || typeof tinyMCE === "undefined") {
                return;
            }

            editor_tools_html = $("#wp-" + getter_tmce + "-editor-tools").html();
            editor_tools_class = $("#wp-" + getter_tmce + "-editor-tools").attr("class");

            $(element).find("textarea").not(":disabled").not(".tm-no-editor").each(function (i, textarea) {
                id = $(textarea).attr("id");
                if (id) {
                    tmc_settings = $.extend({}, init_settings, {
                        selector: "#" + id
                    });
                    tqt_settings = $.extend({}, qt_settings, {
                        id: id
                    });
                    if (typeof tinyMCEPreInit === "object") {
                        tinyMCEPreInit.mceInit[id] = tmc_settings;
                        tinyMCEPreInit.qtInit[id] = tqt_settings;
                    }
                    $(textarea).addClass("wp-editor-area").wrap("<div id=\"wp-" + id + "-wrap\" class=\"wp-core-ui wp-editor-wrap tmce-active tm_editor_wrap\"></div>")
                    .before("<div class=\"" + editor_tools_class + "\">" + editor_tools_html + "</div>")
                    .wrap("<div class=\"wp-editor-container\"></div>");
                    $(".tm_editor_wrap").find(".wp-switch-editor").each(function (n, s) {

                        var aid;
                        var l;
                        var mode;

                        if ($(s).attr("id")) {
                            aid = $(s).attr("id");
                            l = aid.length;
                            mode = aid.substr(l - 4);
                            $(s).attr("id", id + "-" + mode);
                            $(s).attr("data-wp-editor-id", id);
                        }

                    });
                    $(".tm_editor_wrap").find(".insert-media").attr("data-editor", id);

                    tinyMCE.init(tmc_settings);
                    if (QTags && quicktags) {
                        quicktags(tqt_settings);
                        QTags._buttonsInit();
                    }
                    $(textarea).closest(".tm_editor_wrap").find("a.insert-media").data("editor", id).attr("data-editor", id);
                }
            });

        },

        removeTinyMCE: function (element) {

            var id;
            var _check = "";
            var current_textarea_value;
            var is_tinymce_active;

            if (!$(element) || typeof tinyMCE === "undefined") {
                return;
            }

            $(element).find("textarea").not(":disabled").not(".tm-no-editor").each(function (i, textarea) {
                id = $(textarea).attr("id");
                if (id && tinyMCE && tinyMCE.editors) {

                    current_textarea_value = $(textarea).val();
                    is_tinymce_active = (typeof tinyMCE !== "undefined") && tinyMCE.editors[id] && !tinyMCE.editors[id].isHidden();

                    if (id in tinyMCE.editors) {
                        _check = tinyMCE.editors[id].getContent();
                        tinyMCE.editors[id].remove();
                    }
                    $(textarea).closest(".tm_editor_wrap").find(".quicktags-toolbar,.wp-editor-tools").remove();
                    $(textarea).unwrap().unwrap();

                    if (is_tinymce_active) {
                        if (_check === "") {
                            $(textarea).val("");
                        } else {
                            $(textarea).val(_check);
                        }
                    } else {
                        $(textarea).val(current_textarea_value);
                    }
                }
            });

        },

        set_fields_change: function (obj) {

            var btxpd;

            if (!obj) {
                obj = $(".builder_textfield_price_type");
            }
            if ($(obj).length === 0) {
                return;
            }
            obj.each(function () {
                btxpd = $(this).closest(".builder_element_wrap").find(".builder_price_div");

                if ($(this).val() === "currentstep") {
                    if (btxpd.length) {
                        btxpd.hide();
                    }
                } else {
                    if (btxpd.length) {
                        btxpd.show();
                    }
                }
            });

        },

        set_field_title: function (obj) {

            var id;
            var title;

            if (!obj) {
                obj = $(".bitem");
                obj.each(function (i, el) {
                    if ($(el).find(".tm-header-title").length === 0) {
                        return true;
                    }

                    id = $(el);
                    $(el).find(".tm-header-title").data("id", id);
                    title = $(el).find(".tm-header-title").val();
                    if (!(title === undefined || title === "")) {
                        $(el).find(".tm-label").html(title);
                    }

                });

            }

            if ($(obj).length === 0 || !obj.is(".tm-header-title")) {
                return;
            }

            title = obj.val();
            id = obj.data("id");

            if (title === undefined || title === "") {
                $(id).find(".tm-label").html("&nbsp;");
            } else {
                $(id).find(".tm-label").html(title);
            }

        },

        set_hidden: function () {
            $(".builder_wrapper").each(function (i, section) {

                var $this = $(this);

                $this.find(".tm_builder_sections").val($(this).find(".bitem ").length);
                $this.find(".tm_builder_section_slides").val(function () {
                    if (!$this.is(".tm-slider-wizard")) {
                        return "";
                    }
                    return $this.find(".bitem_wrapper")
                    .map(function (i, e) {
                        return $(e).children(".bitem").not(".pl2, .element_is_disabled").length;
                    }).get().join(",");
                });
                $this.find(".tm_builder_sections_size").val(function () {
                    var _size = $(section).attr("class").split(" ")
                    .map(function (cls) {
                        if (cls.match(/w\d+/g) !== null) {
                            return cls;
                        }
                    })
                    .filter(function (v) {
                        if (v !== null && v !== undefined) {
                            return v;
                        }
                    });
                    return _size[0];
                });
                $this.find(".div_size").val(function () {
                    var _size = $(this).closest(".bitem").attr("class").split(" ")
                    .map(function (cls) {
                        if (cls.indexOf("w", 0) !== -1) {
                            return cls;
                        }
                    })
                    .filter(function (v) {
                        if (v !== null && v !== undefined) {
                            return v;
                        }
                    });
                    return _size[0];
                });

            });
        },

        tm_upload_button_remove_onClick: function () {

            var input = $(this).prevAll("input").first();
            var image = $(this).nextAll(".tm_upload_image").first().find(".tm_upload_image_img");

            $(input).val("");
            $(image).attr("src", "");

        },

        variations_display_as: function (e) {

            var $this;
            var tm_attribute;
            var tm_terms;
            var tm_changes_product_image;

            if (e) {
                if ($(this).is(".tm-changes-product-image")) {
                    $this = $(this).closest(".tm-attribute").find(".variations-display-as");
                } else {
                    $this = $(this);
                }
            } else {
                $this = $("#temp_for_floatbox_insert .variations-display-as");
            }

            $this.each(function (i, el) {

                var selected_mode;

                tm_attribute = $(el).closest(".tm-attribute");
                tm_terms = tm_attribute.find(".tm-term");
                tm_changes_product_image = tm_attribute.find(".tm-changes-product-image");
                selected_mode = $(el).val();
                if (selected_mode === "select") {
                    tm_attribute.find(".tma-hide-for-select-box").hide().addClass("tm-row-hidden");
                } else {
                    tm_attribute.find(".tma-hide-for-select-box").show().removeClass("tm-row-hidden");
                }
                if (selected_mode === "image" || selected_mode === "color" || selected_mode === "radiostart" || selected_mode === "radioend") {
                    tm_attribute.find(".tma-show-for-swatches").show().removeClass("tm-row-hidden");
                } else {
                    tm_attribute.find(".tma-show-for-swatches").hide().addClass("tm-row-hidden");
                }
                tm_terms.each(function (i2, term) {
                    $(term).hide().find(".tma-term-color,.tma-term-image,.tma-term-custom-image").hide();
                    switch (selected_mode) {
                    case "select":
                        if (tm_changes_product_image.val() === "images") {
                            tm_changes_product_image.val("");
                        }
                        tm_changes_product_image.children("option[value='images']").attr("disabled", "disabled").hide();
                        if (tm_changes_product_image.val() === "custom") {
                            $(term).show().find(".tma-term-custom-image").show();
                        }

                        break;
                    case "radio":
                        if (tm_changes_product_image.val() === "images") {
                            tm_changes_product_image.val("");
                        }
                        tm_changes_product_image.children("option[value='images']").attr("disabled", "disabled").hide();
                        if (tm_changes_product_image.val() === "custom") {
                            $(term).show().find(".tma-term-custom-image").show();
                        }
                        break;
                    case "image":
                    case "radiostart":
                    case "radioend":
                        tm_changes_product_image.children("option[value='images']").removeAttr("disabled").show();
                        $(term).show().find(".tma-term-image").show();
                        if (tm_changes_product_image.val() === "custom") {
                            $(term).show().find(".tma-term-custom-image").show();
                        }
                        break;
                    case "color":
                        if (tm_changes_product_image.val() === "images") {
                            tm_changes_product_image.val("");
                        }
                        tm_changes_product_image.children("option[value='images']").attr("disabled", "disabled").hide();
                        if (tm_changes_product_image.val() === "custom") {
                            $(term).show().find(".tma-term-custom-image").show();
                        }
                        $(term).show().find(".tma-term-color").show();
                        break;
                    }

                });

            });

        },

        tm_upload: function () {

            var $this = $("#temp_for_floatbox_insert");
            var $use_images_all = $this.find(".use_images").not(".tm-changes-product-image");
            var $use_color_all = $this.find(".use_colors");
            var $use_div_images = $this.find(".tm-use-images");
            var $use_div_colors = $this.find(".tm-use-colors");
            var $use_imagesp_all = $this.find(".tm-changes-product-image");
            var $swatchmode = $this.find(".swatchmode");
            var $use_lightbox = $("#temp_for_floatbox_insert .tm-show-when-use-images");
            var $show_when_use_color = $("#temp_for_floatbox_insert .tm-show-when-use-color");
            var tm_upload = $this.find(".builder_element_wrap").find(".tm_upload_button").not(".tm_upload_buttonp,.tm_upload_buttonl");
            var tm_upload_image = $this.find(".builder_element_wrap").find(".tm_upload_image").not(".tm_upload_imagep,.tm_upload_imagel");
            var tm_uploadp = $this.find(".builder_element_wrap").find(".tm_upload_buttonp");
            var tm_upload_imagep = $this.find(".builder_element_wrap").find(".tm_upload_imagep");
            var tm_uploadl = $this.find(".builder_element_wrap").find(".tm_upload_buttonl");
            var tm_upload_imagel = $this.find(".builder_element_wrap").find(".tm_upload_imagel");
            var tm_cell_images = $this.find(".builder_element_wrap").find(".tm_cell_images");
            var tm_color_picker = $this.find(".builder_element_wrap .panels_wrap").find(".sp-replacer");
            var tm_option_image;
            var tm_option_imagep;
            var tm_upload_imagep_img;

            tm_upload.hide();
            tm_upload_image.hide();
            tm_uploadp.hide();
            tm_upload_imagep.hide();
            tm_uploadl.hide();
            tm_upload_imagel.hide();
            tm_cell_images.hide();
            tm_color_picker.hide();

            if ($use_images_all.val() !== "" && $use_color_all.val() !== "") {
                $use_div_colors.show();
                $use_div_images.show();
            }
            if ($use_images_all.val() === "" && $use_color_all.val() === "") {
                $use_div_colors.show();
                $use_div_images.show();
            }
            if ($use_images_all.val() !== "" && $use_color_all.val() === "") {
                $use_div_colors.hide();
                $use_div_images.show();
            }
            if ($use_images_all.val() === "" && $use_color_all.val() !== "") {
                $use_div_colors.show();
                $use_div_images.hide();
            }

            if ($use_imagesp_all.val() === "images" && $use_images_all.val() === "") {
                tm_option_image = $this.find(".tm_option_image").not(".tm_option_imagep");
                tm_option_imagep = $this.find(".tm_option_imagep");
                tm_upload_imagep_img = $this.find(".tm_upload_imagep .tm_upload_image_img");
                $use_imagesp_all.val("custom");
                tm_option_image.each(function (i) {
                    tm_option_imagep.eq(i).val($(this).val());
                    tm_upload_imagep_img.attr("src", $(this).val());
                });
            }

            if (!$use_images_all.length || $use_images_all.val() !== "images") {
                if ($use_imagesp_all.val() === "images") {
                    $use_imagesp_all.val("");
                }
                $use_imagesp_all.find("option[value='images']").attr("disabled", "disabled").hide();
            } else {
                $use_imagesp_all.find("option[value='images']").removeAttr("disabled").show();
            }
            if (( $use_images_all.val() === "images" || $use_images_all.val() === "start" || $use_images_all.val() === "end" ) || ( $use_images_all.val() === "images" && $use_imagesp_all.val() === "images")) {
                tm_upload.show();
                tm_upload_image.show();
                tm_cell_images.show();
            }
            if ($use_imagesp_all.val() === "custom") {
                tm_uploadp.show();
                tm_upload_imagep.show();
                tm_cell_images.show();
            }
            if ($use_images_all.val() !== "") {
                $use_lightbox.show();
                if ($("#temp_for_floatbox_insert .tm-use-lightbox").val() === "lightbox") {
                    tm_uploadl.show();
                    tm_upload_imagel.show();
                }
            } else {
                $use_lightbox.hide();
            }
            if ($use_color_all.val() === "color") {
                $show_when_use_color.show();
                if ($swatchmode.val() === "swatch_img" || $swatchmode.val() === "swatch_img_lbl" || $swatchmode.val() === "swatch_img_desc" || $swatchmode.val() === "swatch_img_lbl_desc") {
                    $swatchmode.val("");
                }
                $swatchmode.find("option[value='swatch_img']").attr("disabled", "disabled").hide();
                $swatchmode.find("option[value='swatch_img_lbl']").attr("disabled", "disabled").hide();
                $swatchmode.find("option[value='swatch_img_desc']").attr("disabled", "disabled").hide();
                $swatchmode.find("option[value='swatch_img_lbl_desc']").attr("disabled", "disabled").hide();
            } else {
                $swatchmode.find("option[value='swatch_img']").removeAttr("disabled").show();
                $swatchmode.find("option[value='swatch_img_lbl']").removeAttr("disabled").show();
                $swatchmode.find("option[value='swatch_img_desc']").removeAttr("disabled").show();
                $swatchmode.find("option[value='swatch_img_lbl_desc']").removeAttr("disabled").show();

                if ($use_images_all.val() !== "images") {
                    $show_when_use_color.hide();
                }
            }

            if (( $use_color_all.val() === "color" || $use_color_all.val() === "start" || $use_color_all.val() === "end" )) {
                tm_cell_images.show();
                tm_color_picker.show();
            }

        },

        tm_weekdays: function (e) {

            var obj;

            if (e) {
                obj = $(e);
            } else {
                obj = $("body");
            }

            obj.find(".tm-weekdays").each(function (i, el) {

                var val = $(el).val();
                var values = val.split(",");
                var wrap = $(el).next(".tm-weekdays-picker-wrap");
                var pickers = $(wrap).find(".tm-weekday-picker");

                pickers.each(function (x, picker) {
                    if (values.indexOf($(picker).val()) !== -1) {
                        $(picker).attr("checked", "checked").prop("checked", true);
                        $(picker).closest(".tm-weekdays-picker").addClass("tm-checked");
                    } else {
                        $(picker).removeAttr("checked").prop("checked", false);
                        $(picker).closest(".tm-weekdays-picker").removeClass("tm-checked");
                    }
                });

            });

        },

        tm_weekday_picker: function () {

            var weekdays = $(this).closest(".tm-weekdays-picker-wrap").prev(".tm-weekdays");
            var values = $(weekdays).val().split(",");
            var c = values.indexOf($(this).val());

            if ($(this).is(":checked")) {
                if (c === -1) {
                    values.push($(this).val());
                }
            } else {
                if (c !== -1) {
                    values.splice(c, 1);
                }
            }
            values = $.map(values, function (item) {
                return item === "" ? null : item;
            });
            $(weekdays).val(values.join(","));
            $.tmEPOAdmin.tm_weekdays($(weekdays).parent());

        },

        tm_qty_selector: function (e) {

            var $this;
            var $use_url;
            var use_url;

            if (e) {
                $use_url = $(this);
            } else {
                $use_url = $("#temp_for_floatbox_insert .tm-qty-selector");
            }
            $this = $("#temp_for_floatbox_insert");
            use_url = $this.find(".builder_element_wrap").find(".tm-show-for-quantity");
            if ($use_url.val() !== "") {
                use_url.show();
            } else {
                use_url.hide();
            }

        },

        tm_pricetype_selector: function (e) {

            var $this;
            var $use_url;
            var use_url;

            if (e) {
                $use_url = $(this);
            } else {
                $use_url = $("#temp_for_floatbox_insert .tm-pricetype-selector");
            }
            $this = $("#temp_for_floatbox_insert");
            use_url = $this.find(".builder_element_wrap").find(".tm-show-for-per-chars");
            if ($use_url.val() === "wordnon" || $use_url.val() === "wordpercentnon" || $use_url.val() === "charnon" || $use_url.val() === "charnonnospaces" || $use_url.val() === "charpercentnon" || $use_url.val() === "charpercentnonnospaces") {
                use_url.show();
            } else {
                use_url.hide();
            }

        },

        selectbox_price_type: function (e) {

            var $this = $("#temp_for_floatbox_insert");
            var priceTypeSelector = $(e);
            var priceTypes = $this.find(".builder_element_wrap").find(".tm_option_price_type.multiple_selectbox_options");

            if (!e) {
                priceTypeSelector = $("#temp_for_floatbox_insert .tm_select_price_type.selectbox");
            }

            if (priceTypeSelector.length) {
                if (priceTypeSelector.val() === "") {
                    priceTypes.show();
                } else {
                    priceTypes.hide();
                }
            }

        },

        tm_url: function (e) {

            var $this = $("#temp_for_floatbox_insert");
            var $use_url = $(this);
            var use_url = $this.find(".builder_element_wrap").find(".tm_cell_url");

            if (!e) {
                $use_url = $("#temp_for_floatbox_insert .use_url");
            }

            if ($use_url.val() === "url") {
                use_url.show();
            } else {
                use_url.hide();
            }

        },

        upload: function (e) {

            var _this;
            var _this_image;
            var InsertImage;
            var $tm_upload_frame;

            e.preventDefault();

            if (wp && wp.media) {

                _this = $(this).prev("input");
                _this_image = $(this).nextAll(".tm_upload_image").first().find("img");

                if (_this.data("tm_upload_frame")) {
                    _this.data("tm_upload_frame").open();
                    return;
                }

                InsertImage = wp.media.controller.Library.extend({
                    defaults: _.defaults({
                        id: "insert-image",
                        title: "Insert Image Url",
                        allowLocalEdits: true,
                        displaySettings: true,
                        displayUserSettings: true,
                        multiple: true,
                        type: "image"//audio, video, application/pdf, ... etc
                    }, wp.media.controller.Library.prototype.defaults)
                });

                $tm_upload_frame = wp.media({
                    button: {text: "Select"},
                    state: "insert-image",
                    states: [
                        new InsertImage()
                    ]
                });

                $tm_upload_frame.on("close", function () {
                    return;
                });
                $tm_upload_frame.on("select", function () {

                    var state = $tm_upload_frame.state("insert-image");
                    var selection = state.get("selection");

                    if (!selection) {
                        return;
                    }

                    _this_image.attr("src", "");
                    _this.val("");

                    selection.each(function (attachment) {

                        var display = state.display(attachment).toJSON();
                        var obj_attachment = attachment.toJSON();
                        var caption = obj_attachment.caption;
                        var options;

                        // If captions are disabled, clear the caption.
                        if (!wp.media.view.settings.captions) {
                            delete obj_attachment.caption;
                        }
                        display = wp.media.string.props(display, obj_attachment);

                        options = {
                            id: obj_attachment.id,
                            post_content: obj_attachment.description,
                            post_excerpt: caption
                        };

                        if (display.linkUrl) {
                            options.url = display.linkUrl;
                        }
                        if ("image" === obj_attachment.type) {
                            _.each({
                                align: "align",
                                size: "image-size",
                                alt: "image_alt"
                            }, function (option, prop) {
                                if (display[prop]) {
                                    options[option] = display[prop];
                                }
                            });
                            if (options["image-size"] && attachment.attributes.sizes[options["image-size"]]) {
                                options.url = attachment.attributes.sizes[options["image-size"]].url;
                            }
                        } else {
                            options.post_title = display.title;
                        }

                        _this_image.attr("src", options.url);
                        _this.val(options.url);

                    });

                });

                $tm_upload_frame.on("open", function () {

                    var selection = $tm_upload_frame.state().get("library").toJSON();
                    var isinit = true;

                    $.each(selection, function (i, _el) {

                        var attachment;

                        if (_el.url === _this.val()) {
                            attachment = wp.media.attachment(_el.id);
                            $tm_upload_frame.state().get("selection").add(attachment ? [attachment] : []);
                            $(".attachment-display-settings").find("select.size").val("full");
                            isinit = false;
                        } else if (_el.sizes) {
                            $.each(_el.sizes, function (s, size) {
                                if (size.url === _this.val()) {
                                    attachment = wp.media.attachment(_el.id);
                                    $tm_upload_frame.state().get("selection").add(attachment ? [attachment] : []);
                                    $(".attachment-display-settings").find("select.size").val(s);
                                    isinit = false;
                                }
                            });
                        }
                        if (isinit) {
                            $(".attachment-display-settings").find("select.size").val("full");
                        }

                    });

                });

                _this.data("tm_upload_frame", $tm_upload_frame);
                $tm_upload_frame.open();
            } else {
                return false;
            }

        }

    };   

    $(document).ready(function () {

        var bulk_action_selector_top = $("#bulk-action-selector-top");
        var found = false;

        woocommerce_admin = window.woocommerce_admin;
        tinyMCEPreInit = window.tinyMCEPreInit;
        QTags = window.QTags;
        quicktags = window.quicktags;
        tinyMCE = window.tinyMCE;

        if (bulk_action_selector_top.length > 0) {
            bulk_action_selector_top.children("option").each(function (i, o) {
                if ($(o).val() === "tcline") {
                    found = true;
                    $(o).replaceWith($("<optgroup class=\"tc-bulk-opt\" label=\"" + $(o).text() + "\">"));
                } else if (found && ( $(o).val() !== "tcclear" && $(o).val() !== "tcproductclear" && $(o).val() !== "tcclearexclude" && $(o).val() !== "tcclearexcludeadd" )) {
                    $(o).appendTo($(".tc-bulk-opt"));
                }
                if ($(o).val() === "tcline2") {
                    $(o).remove();
                }
            });
        }

        $.tmEPOAdmin.initialitize();

        $.tcToolTip();

    });
}(window, document, window.jQuery));