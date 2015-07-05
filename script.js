/**
* The fastwiki plugin loads 'do' actions as AJAX requests when possible, to speed up the page. It also adds section editing.
*/
var plugin_fastwiki = (function($) {
	var m_viewMode, m_origViewMode; // show, edit, secedit, subscribe
	var m_hasDraft;
	var m_pageObjs = {}; // Edit objects
	var m_content;
	var m_initialId;

	/**
	* Map of identifying selector to special cases. Use selectors instead of template names because there are families of templates.
	*
	* @private
	*/
	var m_tplSpecialCases = (function() {
		var m_showRow, m_editRow;

		var m_utils = {
			makeShowLink(url) {
				url = url.replace(/\?do=.*$/, '');
				return '<a href="' + url + '" class="action show" accesskey="v" rel="nofollow" title="' + JSINFO.fastwiki_text_btn_show + ' [V]"><span>' + JSINFO.fastwiki_text_btn_show + '</span></a>';
			},

			// Add a "show" link for templates which have a <ul> list of action links.
			makeShowRowLI: function(pagetools) {
				var showLink = $("a[href $= 'do=']", pagetools);
				if (showLink.length > 0)
					m_showRow = $(showLink.parents('li')[0]);
				else {
					var link = $("a[href *= 'do=']", pagetools)[0];
					if (link) {
						m_showRow = $('<li>' + m_utils.makeShowLink(link.href) + '</li>').toggle(m_viewMode != 'show');
						pagetools.prepend(m_showRow);
					}
				}
			},

			// Update button bars
			fixButtons: function(showParent, allButtons) {
				var showBtn = $('.button.btn_show', showParent);
				if (showBtn.length == 0) {
					var url = $('form.button', allButtons)[0].action;
					showBtnHtml = '<form class="button btn_show" method="get" action="' + url + '"><div class="no"><input type="hidden" name="do" value=""><input type="submit" value="' + JSINFO.fastwiki_text_btn_show + '" class="button" accesskey="v" title="' + JSINFO.fastwiki_text_btn_show + ' [V]"></div></form>';
					showParent.each(function(idx, elt) {
						var newBtn = $(showBtnHtml);
						showBtn = showBtn.add(newBtn);
						$(elt).prepend(newBtn.toggle(m_viewMode!='show'));
					});
				}
				var editBtn = $('.button.btn_edit', allButtons);
				if (editBtn.length > 0)
					m_editRow = m_editRow ? m_editRow.add(editBtn) : editBtn;
				m_showRow = m_showRow ? m_showRow.add(showBtn) : showBtn;
			}
		};

		return {
			// dokuwiki, starter, greensteel
			dokuwiki: {
				isActive() {
					return $('#dokuwiki__pagetools').length > 0;
				},
				init: function() {
					m_utils.makeShowRowLI($("#dokuwiki__pagetools ul"));
				},
				updateAfterSwitch: function(mode, isSectionEdit) {
					// The dokuwiki template hides the sidebar in non-show modes
					$("#dokuwiki__top").toggleClass("showSidebar hasSidebar", mode=='show');
					$("#dokuwiki__aside").css('display', mode=='show' ? '' : 'none');
					m_showRow.toggle(mode != 'show');
				},
				// Only show is supported as a start mode, because otherwise, we'd have to add pagetools for each action and check for actions being allowed.
				startModeSupported: function(action) {
					return action == 'show';
				}
			},
			starterbootstrap: {
				isActive() {
					return $('ul.nav.navbar-nav').length > 0;
				},
				init: function() {
					var pagetools = $("ul.nav.navbar-nav");
					m_utils.makeShowRowLI(pagetools);
					m_editRow = $($('li', pagetools)[0])
				},
				updateAfterSwitch: function(mode, isSectionEdit) {
					m_showRow.toggle(mode != 'show');
					m_editRow.toggle(mode != 'edit' && mode != 'draft');
				},
				// Only show is supported as a start mode, because otherwise, we'd have to add pagetools for each action and check for actions being allowed.
				startModeSupported: function(action) {
					return action == 'show';
				}
			},
			arctic: {
				isActive() {
					return JSINFO.fastwiki_templatename == 'arctic';
				},
				init: function() {
					var buttonBars = $('#bar__bottom, #bar__top');
					if ($('.button', buttonBars).length > 0)
						m_utils.fixButtons($('.bar-left'), buttonBars)
					else {
						var pagetools = $('.bar-left');
						m_editRow = $("a[href *= 'do=edit']", pagetools)
						m_showRow = $("a[href $= 'do=']", pagetools[0]);
						if (m_showRow.length == 0) {
							var url = $("a[href *= 'do=']")[0].href;
							m_showRow = $();
							pagetools.each(function(idx, elt) {
								var show = $(m_utils.makeShowLink(url)).toggle(mode != 'show');
								m_showRow = m_showRow.add(show);
								$(elt).prepend(show);
							});
						}
					}
				},
				updateAfterSwitch: function(mode, isSectionEdit) {
					m_showRow.toggle(mode != 'show');
					m_editRow.toggle(mode != 'edit' && mode != 'draft');
					$(".left_sidebar, .right_sidebar").css('display', mode=='show' ? '' : 'none');
				},
				// Only show is supported as a start mode, because otherwise, we'd have to add pagetools for each action and check for actions being allowed.
				startModeSupported: function(action) {
					return action == 'show';
				}
			},
			// scanlines
			scanlines: {
				isActive() {
					return $('.stylehead .bar_top .bar_top_content').length > 0;
				},
				family: 'scanlines',
				init: function() {
					// If the toolbox is enabled.
					var toolbox = $(".sidebar_content .li_toolbox ul");
					m_utils.makeShowRowLI(toolbox);
					m_editRow = $('.action.edit', toolbox).parent();

					// Button bar
					m_utils.fixButtons($('.bar_bottom_content .bar-right'), $('.bar_bottom_content .bar-right'))
				},
				updateAfterSwitch: function(mode, isSectionEdit) {
					$(".right_sidebar, .left_sidebar").css('display', mode=='edit' ? 'none' : '');
					m_showRow.toggle(mode != 'show');
					m_editRow.toggle(mode != 'edit' && mode != 'draft');

					// In this template, two levels of DOM structure are missing in edit mode. Clear out their styles.
					if (mode == 'edit' || mode == 'draft') {
						$('.page_720').css({border: 0, textAlign: 'inherit'});
						$('.left_page, .right_page').css({float:'none', width:'auto'});
					}
					else {
						$('.page_720').css({border: '', textAlign: ''});
						$('.left_page, .right_page').css({float:'', width:''});
					}
				}
			},
			// vector, prsnl10
			fully_supported: {
				isActive() {return true;}
			}
		};
	})();

	/**
	* tpl_init_fastwiki() can be defined by a template to set its own configuration.
	*/
	if (window.tpl_init_fastwiki)
		m_tplSpecialCases = tpl_init_fastwiki();

	var m_tpl = {};


	//////////
	// On load initialization
	//////////
	$(function() {
		// Get template special cases.
		for (var tpl in m_tplSpecialCases) {
			if (m_tplSpecialCases[tpl].isActive()) {
				m_tpl = m_tplSpecialCases[tpl];
				break;
			}
		}

		// Inline section edit
		$('.btn_secedit input[type=submit]').each(function(idx, elt) {
			$(elt).click(function(e) {
				e.preventDefault();
				load('edit', $(this).parents('form'))
			});
		});

		// Leaving imgdetail with ajax is just too complicated to support.
		if (document.location.href.indexOf("detail.php") >= 0)
			m_viewMode = 'unsupported';
		else {
			var urlParams = _urlToObj(document.location.href);
			m_viewMode = urlParams['do'] || 'show';
			if (m_tpl.startModeSupported && !m_tpl.startModeSupported(m_viewMode))
				m_viewMode = 'unsupported';
		}
		m_origViewMode = m_viewMode;

		// plugin_fastwiki_marker was added by the action plugin. It makes it possible to find the main content area regardless of the template used.
		m_content = $('.plugin_fastwiki_marker').parent();
		m_content.addClass('content_initial');
		m_initialId = m_content.attr('id');

		m_modeClassElt = m_content.hasClass('dokuwiki') ? m_content : $(m_content.parents('.dokuwiki')[0] || document.body);

		if (m_tpl.init)
			m_tpl.init();

		fixActionLinks(document.body);
	});


	/**
	* Find supported action links (do=???) and references to the current page, and turn them into AJAX requests.
	*
	* @param {DOMNode} elt - Do it inside this element.
	*/
	function fixActionLinks(elt) {
		if (m_origViewMode == 'unsupported')
			return;

		// Unsupported actions, and reason for lack of support:
		// login, register and resendpwd: Templates, plugins or future versions of dokuwiki might make them https.
		// admin: It's too hard -- too many modes, too many buttons to hook, and a custom TOC.
		// conflict, denied and locked: I don't know what they do.
		var supportedActions = {'':1, edit:1, draft:1, history:1, recent:1, revisions:1, show:1, subscribe:1, backlink:1, index:1, profile:1, media:1, diff:1};
		var formActions = {search: 1};
		var supportedFields = {'do':1, rev:1, id:1};

		// TODO: Support search: Hook search box, not just href. Note that supporting search changes doku behavior -- search results now have namespaces and origin pages.
		//		Because of this, search will have to be a seperate config setting.
		// TODO: Profile needs button hooks.

		// Intercept all action (do=) urls, switching them to AJAX.
		$('a[href *= "?do="]', elt).click(function(e) {
			var params = _urlToObj(this.href);
			if (!params['do'])
				params['do'] = 'show';

			if (params['do'] in supportedActions) {
				e.preventDefault();
				load(params['do'], null, params);
			}
		});

		$('input[type="submit"], input[type="button"], button', elt).click(function(e) {
			var form = $(this).parents('form');
			if (form.length > 0 && form[0]['do'] && form[0]['do'].value in supportedActions) {
				// For now, only allow very simple forms
				var supported = true;
				$('input[type != "submit"]', form).each(function(idx, elt) {
					if (elt.type != 'button' && (elt.type != 'hidden' || !(elt.name in supportedFields)))
						supported = false;
				});

				if (supported) {
					e.preventDefault();
					var params = _formToObj(form[0]);
					if (!params['do'])
						params['do'] = 'show';
					load(params['do'], null, params);
				}
			}
		});

		// Only fix self-referrential links if we started out in show mode.
		if (m_origViewMode == 'show' && window.JSINFO) {
			$('a[href $= "id=' + JSINFO.id + '"], a[href $= "doku.php/' + JSINFO.id.replace(/:/g, '/') + '"], a[href = "/' + JSINFO.id.replace(/:/g, '/') + '"]', elt).click(function(e) {
				e.preventDefault();
				load('show');
			});
		}
	}


	/**
	* Preview a page edit without reloading the page.
	*
	* @private
	* @param {Form=} sectionForm - If a section is being edited instead of the whole document, this is the form in that section.
	*/
	function _preview(sectionForm) {
		var body = $(document.body);
		var params = _formToObj($('#dw__editform'));
		params['do'] = 'preview';
		_sendPartial(params, $('.dokuwiki .editBox'), function(data) {
			var preview = $('<div id="preview_container">' + data + '</div>');

			// In case anything changed, migrate values over to the existing form.
			var pvEditor = preview.find('#dw__editform');
			var editor = $('#dw__editform')[0];
			pvEditor.find('input[type=hidden]').each(function(idx, elt) {
				editor[elt.name].value = elt.value;
			});

			// Strip out the editor. We already have that.
			preview.find('#scroll__here').prevAll().remove();

			var oldpreview = $('#preview_container');
			if (oldpreview.length > 0)
				oldpreview.replaceWith(preview);
			else
				$('.content_partial').append(preview);

			setTimeout(function() {
				$('html,body').animate({scrollTop: $('#scroll__here').offset().top+'px'}, 300);
			}, 1);
		}, 'text');
	}


	/**
	* Get an editable page section.
	* Algorithm taken from dw_page.sectionHighlight().
	*
	* @private
	* @param {Form=} sectionForm - The form representing the editable section.
	*/
	function _getSection(sectionForm) {
		var pieces = $();
		var target = sectionForm.parent();
		var nr = target.attr('class').match(/(\s+|^)editbutton_(\d+)(\s+|$)/)[2];

		// Walk the dom tree in reverse to find the sibling which is or contains the section edit marker
		while (target.length > 0 && !(target.hasClass('sectionedit' + nr) || target.find('.sectionedit' + nr).length)) {
			target = target.prev();

			// If it's already highlighted, get all children.
			if (target.hasClass('section_highlight'))
				pieces = pieces.add(target.children());
			pieces = pieces.add(target);
		}
		return pieces;
	}


	/**
	* Initialize a page edit. This must be called every time the editor is loaded.
	* Most of this function was derived from core DokuWiki scripts, because Doku doesn't have init functions -- it does
	* all initialization in global jQuery DOMConentReady scope.
	*
	* @private
	*/
	function _initEdit() {
		dw_editor.init();
		dw_locktimer.init(JSINFO.fastwiki_locktime, JSINFO.fastwiki_usedraft);

		// From edit.js
		var $editform = jQuery('#dw__editform');
		if ($editform.length == 0)
			return;

		var $edit_text = $('#wiki__text');
		if ($edit_text.length > 0) {
			if (!$edit_text.attr('readOnly')) {
				// set focus and place cursor at the start
				var sel = DWgetSelection($edit_text[0]);
				sel.start = 0;
				sel.end = 0;
				DWsetSelection(sel);
				$edit_text.focus();
			}
		}

		$editform.on("change keydown", function(e) {
			window.textChanged = true;
			summaryCheck();
		});

		m_pageObjs.content = $edit_text.val();
		window.onbeforeunload = function() {
			if (window.textChanged && m_pageObjs.content != $edit_text.val())
				return LANG.notsavedyet;
		};
		window.onunload = deleteDraft;

		jQuery('#edbtn__preview').click(function(e) {
			e.preventDefault();
			_preview(m_pageObjs.sectionForm);
			m_hasDraft = true;
			dw_locktimer.reset();
		});

		jQuery('#edit__summary').on("change keyup", summaryCheck);
		if (textChanged)
			summaryCheck();

		// From toolbar.js
		initToolbar('tool__bar','wiki__text',toolbar);
		jQuery('#tool__bar').attr('role', 'toolbar');

		// reset change memory var on submit
		jQuery('#edbtn__save').click(function() {
			window.onbeforeunload = '';
			textChanged = false;
			dw_locktimer.clear();
		});

		// Cancel button on edit, or Delete Draft button on draft.
		$('input[name="do[draftdel]"]', $editform).click(function(e) {
			e.preventDefault();
			var id = $editform.find('input[name=id]').val();
			load('show');

			if (!window.keepDraft) {
				// remove a possibly saved draft using ajax
				jQuery.post(DOKU_BASE + 'lib/exe/ajax.php', {
					call: 'draftdel',
					id: id,
					success: function(data, textStatus, jqXHR) {
						m_hasDraft = false;
					}
				});
			}
		});
		// Cancel button on draft
		$('input[name="do[show]"]', $editform).click(function(e) {
			e.preventDefault();
			load('show');
		});

		$('.picker.pk_hl').addClass('dokuwiki');
	}


	/**
	* Change the current body class to represent the given action.
	*
	* @private
	* @param {String} action - The new page action.
	* @param {String=} target - The part of the page being targetted. Can be one of: {section}
	*/
	function _setBodyClass(action, target) {
		m_modeClassElt.removeClass('mode_show mode_edit mode_subscribe mode_secedit mode_revisions mode_secedit').addClass('mode_'+action);
		// Special case for section edit.
		if (target == 'section')
			m_modeClassElt.removeClass('mode_edit').addClass('mode_show mode_secedit');

		$('.content_partial').toggle(m_viewMode != m_origViewMode);
		$('.content_initial').toggle(m_viewMode == m_origViewMode || target == 'section');
	}


	/**
	* Update page objects on view switch.
	*
	* @private
	*/
	function _updatePageObjsOnSwitch() {
		if (m_pageObjs.showOnSwitch)
			m_pageObjs.showOnSwitch.show();
		delete m_pageObjs.showOnSwitch;
		delete m_pageObjs.content;
		delete m_pageObjs.sectionForm;

		var hasToc = {show: 1, admin: 1};

		// #dw__toc is common to all templates. #dw_toc_head is from the zioth template. #dw_toc is from starterbootstrap
		$("#dw__toc, #dw_toc_head, #dw_toc").css('display', m_viewMode in hasToc ? '' : 'none');
	}


	/**
	* Convert a form to an object suitable for $.post().
	*
	* @private
	*/
	function _formToObj(form) {
		var obj = {};
		$(form).serializeArray().map(function(item){obj[item.name] = item.value;});
		return obj;
	}


	/**
	* Convert a url to an object suitable for $.post().
	*
	* @private
	*/
	function _urlToObj(url) {
		var obj = {};
		var a = url.replace(/.*\?/, '').split('&');
		for (var x=0; x<a.length; x++) {
			var parts = unescape(a[x]).split('=');
			var name = parts.shift();
			obj[name] = parts.join('='); // Restore any lost = signs from the split.
		}
		return obj;
	}


	/**
	* Perform a standard partial AJAX action (edit, history, etc).
	*
	* @param {DOMNode=} insertLoc - Optional
	* @private
	*/
	function _action(action, params, callback, insertLoc) {
		params['do'] = action;

		_sendPartial(params, _getVisibleContent(), function(data) {
			_setBodyClass(action, params.target);
			$('.content_partial, .message_partial').remove();
			$('.content_initial').attr('id', m_initialId);

			if (insertLoc) {
				var body = $('<div class="content_partial"></div>').append(data);
				insertLoc.after(body);
			}
			// This kind of partial replaces the whole content area.
			else {
				// Swap ids and classes, so the new element is styled correctly.
				var initial = $('.content_initial');
				var body = $('<div class="content_partial"></div>').addClass(initial[0].className.replace(/content_initial/, '')).attr('id', m_initialId).append(data);
				initial.attr('id', '').after(body);
			}
			fixActionLinks($('.content_partial'));

			_updatePageObjsOnSwitch();

			if (callback)
				callback(data);

			setTimeout(function() {
				if (action == 'edit' || action == 'draft') {
					//TODO: It won't scroll to the right place. It's always about 20px off, even if I add pixels.
					if (document.body.scrollTop > 0)
						$('html,body').animate({scrollTop: body.offset().top+'px'}, 300);
				}
				else
					$('html,body').animate({scrollTop: 0}, 300);
			}, 1);

			if (m_tpl.updateAfterSwitch)
				m_tpl.updateAfterSwitch(m_pageObjs.sectionForm?'show':m_viewMode, !!m_pageObjs.sectionForm);
		}, 'text');
	}


	/**
	* Send a "partial" action, used for AJAX editing, previews, subscribe etc.
	*
	* @param {Object} params - Parameters to send to doku.php.
	* @param {DOMNode} spinnerParent - Center the loading spinner in this object.
	* @param {Function} callback - Call this function, with the content HTML as a parameter, when the action is complete.
	* @private
	*/
	function _sendPartial(params, spinnerParent, callback) {
		if ($('.partialsLoading').length == 0) {
			var spinnerCss = spinnerParent.height() + spinnerParent.offset().top > $(window).height() ? {top: $(window).height() / 2} : {top: '50%'};
			spinnerParent.append($('<div class="partialsLoading"></div>').css('display', 'none').css(spinnerCss));
			// Give it some time in case the page is really responsive.
			setTimeout(function() {$('.partialsLoading').css('display', '');}, 500);
		}

		params.partial = 1;

		jQuery.post(document.location.href, params, function(data) {
			callback(data);
			// Remove all loading spinners, in case a bug let some extras slip in.
			$('.partialsLoading').remove();
		}, 'text');
	}


	/**
	* Return the currently visible content area.
	*/
	function _getVisibleContent() {
		var parentElt = $('.content_partial');
		if (parentElt.length == 0)
			parentElt = $('.content_initial');
		return parentElt;
	}


	/**
	* Load a new view, using AJAX to avoid page re-load.
	*
	* @param {String} page - The view to load. This can be 'show,' or the value of a do= action param.
	* @param {Form} sectionForm - Only valid when page=='edit' or page=='draft'. Used to edit a section inline.
	* @param {Object} params - Additional parameters to pass to the AJAX request. For example, 'rev' if a revision is being edited.
	*/
	function load(page, sectionForm, params) {
		// If edit text has changed, confirm before switching views.
		if ((m_viewMode == 'edit' || m_viewMode == 'draft') && window.textChanged && m_pageObjs.content != $('#wiki__text').val()) {
			if (!confirm(LANG.notsavedyet))
				return;
		}

		var prevView = m_viewMode;
		m_viewMode = page;
		if (!params)
			params = {};
		window.onbeforeunload = '';
		dw_locktimer.clear();

		// First switch back to the original mode, canceling other modes.
		var wasSecedit = !!m_pageObjs.sectionForm;
		_updatePageObjsOnSwitch();

		// If we're back to the original mode, just clean up and quit.
		if (page == m_origViewMode) {
			_setBodyClass(m_origViewMode);
			$('.content_partial, .message_partial').remove();
			$('.content_initial').attr('id', m_initialId);

			// Scroll to top, except during sectionedit. Then, we want to see the content we just edited.
			if (!wasSecedit) {
				setTimeout(function() {
					$('html,body').animate({scrollTop: 0}, 300);
				}, 1);
			}

			if (m_tpl.updateAfterSwitch)
				m_tpl.updateAfterSwitch(m_pageObjs.sectionForm?'show':m_viewMode, !!m_pageObjs.sectionForm);
			return;
		}

		if (page == 'subscribe') {
			_action(page, params, function(data) {
				// Subscribe actions are a special case. Rather than replace the content, they add a success or error message to the top.
				function subscribeAction(sparams) {
					_sendPartial(sparams, _getVisibleContent(), function(data) {
						// data is just a success or error message.
						load(m_origViewMode);

						var body = $('<div class="message_partial"></div>').append(data);
						$('.content_initial').before(body);
					}, 'text');
				}

				var form = $('#subscribe__form');
				$('input[name="do[subscribe]"]', form).click(function(e) {
					e.preventDefault();
					subscribeAction(_formToObj(form));
				});

				$('.content_partial .unsubscribe').click(function(e) {
					e.preventDefault();
					subscribeAction(_urlToObj(this.href));
				});
			});
		}
		else if (page == 'draft' || page == 'edit') {
			var draft = page == 'draft';
			if (m_hasDraft === true)
				draft = true;
			else if (m_hasDraft === false)
				draft = params.rev = null;

			if (sectionForm) {
				// Copy the section edit form into the param list.
				$('input', sectionForm).each(function(idx, elt) {
					params[elt.name] = elt.value;
				});

				m_pageObjs.sectionForm = sectionForm;
				// Save off a list of elements in the section, and then hide the section.
				var sectionParts = _getSection(sectionForm);
				var insertLoc = $(sectionParts[sectionParts.length-1]);

				_action(page, params, function(data) {
					// Define showOnSwitch here, not above, so _updatePageObjsOnSwitch doesn't re-show them too early.
					m_pageObjs.sectionForm = sectionForm; // Redefine.
					sectionParts = sectionParts.add('.editbutton_section');
					m_pageObjs.showOnSwitch = sectionParts;
					m_pageObjs.showOnSwitch.hide();
					_initEdit();
				}, insertLoc);
			}
			else {
				_action(page, params, function(data) {
					_initEdit();
				});
			}
		}
		else if (page == 'revisions' || page == 'diff') {
			_action(page, params, function(data) {
				$('.content_partial form').each(function(idx, form) {
					$('input[name="do[diff]"]', form).click(function(e) {
						e.preventDefault();
						load('diff', null, _formToObj(form));
					});
				});
			});
		}
		// Default action
		else
			_action(page, params);
	};

	return {
		load: load,
		fixActionLinks: fixActionLinks
	};
})(jQuery);