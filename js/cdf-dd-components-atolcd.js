/*!
 * Copyright 2017 Atol Conseils et Développements
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var SvgFileRenderer = ResourceFileRenderer.extend({
	
	constructor: function(tableManager) {
		this.base(tableManager);
		this.logger = new Logger("SvgFileRenderer");
		this.logger.debug("Creating new SvgFileRenderer");
	},

	render: function(placeholder, value, callback) {
		this.callback = callback;
		this.value = value;

		this.validate(value);

		var content = $('<td></td>');
		var _editArea = $('<div class="cdfdd-resourceFileNameRender" >' + Dashboards.escapeHtml(value) + '</div>');
		var idSvg = 'svgFile';
		var _localFileExplorer = $('<input type="file" id="' + idSvg + '" accept="image/svg+xml" style="position: relative; width: 0.1px; height: 0.1px; opacity: 0; overflow: hidden; z-index: -1;" /><label for="' + idSvg + '" style="display:inline-block; position: relative; width: 40px; height: 20px; text-align: center; background-color: #FFFFFF; color: #000000; border: 1px solid #999999;"> Local </label>');
		var _repoFileExplorer = $('<button class="cdfdd-resourceFileExplorerRender"> ^ </button>');
		var myself = this;

		var _prompt = this.renderEditorButton();

		content.append(_editArea);
		content.append(_localFileExplorer);
		content.append(_repoFileExplorer);
		content.append(_prompt);

		CDFDDUtils.makeEditable(_editArea, function(value, settings) {
			myself.logger.debug("Saving new value: " + value);
			callback(value);
			return value;
		}, {
			cssclass: "cdfddInput",
			select: true,
			onsubmit: function(settings, original) {
				var value = $('input', this).val();
				myself.fileName = value;
				return myself.validate(value);
			}
		});
		
		var fileExtensions = this.getFileExtensions();
		
		_localFileExplorer.bind('change', function(event) {
			if (window.File && window.FileReader && window.FileList && window.Blob) {
				var fileSelected = event.target.files[0];
				var fileContent = '';
				var fileName = fileSelected.name;
				var extension = fileName.substring(fileName.lastIndexOf('.'));
				if (extension == fileExtensions) {
					var fileReader = new FileReader();
					fileReader.onload = function(evt) {
						fileContent = fileReader.result;
					}
					fileReader.readAsText(fileSelected);
					
					if (fileSelected) {
						var folderExplorerLabel = 'Choose save location in repository';
						var folderExplorerContent = CDFDDUtils.wrapPopupTitle('Select Folder') +
							CDFDDUtils.wrapPopupBody('<div class="popup-label">' + folderExplorerLabel + '</div>\n' +
							'<div id="container_local_id" class="urltargetfolderexplorer"></div>\n');
									
						var createFileContent = CDFDDUtils.wrapPopupTitle('Create File') +
							CDFDDUtils.wrapPopupBody(
							'<div class="popup-input-container bottom">\n' +
							'  <div class="popup-label">Create File</div>\n' +
							'  <input class="popup-text-input" name="fileName" value="' + fileName + '" />' +
							'</div>\n', 'layout-popup');

						var selectedFile = "";
						var selectedFolder = "";

						var selectFolderOrCreateFile = {
							selectFolder: { // folder explorer
								html: folderExplorerContent,
								buttons: {
									Ok: true,
									Cancel: false
								},
								opacity: 0.2,
								submit: function(v, m, f) {
									if (v) {
										if (selectedFolder.length > 0) {
											$.prompt.goToState('createFile');
											return false;
										}
									}
									return true;
								}
							},

							createFile: { // create file prompt when folder selected
								html: createFileContent,
								buttons: {
									Ok: true,
									Cancel: false
								},
								submit: function(v, m, f) {
									if (v) {
										//new file
										selectedFile = selectedFolder + f.fileName;

										//check extension
										var ext = selectedFile.substring(selectedFile.lastIndexOf('.') + 1);
										if ('.' + ext !== fileExtensions) {
											selectedFile += fileExtensions;
										}

										myself.fileName = selectedFile;
										var file = myself.formatSelection(selectedFile);
										_editArea.text(file);
										var params = {
											createNew: true,
											path: selectedFile,
											data: fileContent
										};
										SynchronizeRequests.createFile(params);
										myself.callback(file);
										return true;
									} else {
										$.prompt.goToState('selectFolder');
										return false;
									}
								}
							}
						};

						CDFDDUtils.prompt(selectFolderOrCreateFile, {
							opacity: '0.2',
							prefix: "popup",
							loaded: function() {
								selectedFile = "";

								var $this = $(this);
								$this.addClass('choose-file-popup');
								CDFDDUtils.movePopupButtons($this.find('#popup_state_selectFolder'));
								CDFDDUtils.movePopupButtons($this.find('#popup_state_createFile'));

								$('#container_local_id').fileTree({
									root: '/',
									script: SolutionTreeRequests.getExplorerFolderEndpoint(CDFDDDataUrl) + "?fileExtensions=null&showHiddenFiles=true" + (CDFDDFileName != "" ? "&dashboardPath=" + CDFDDFileName : ""),
									expandSpeed: 1000,
									collapseSpeed: 1000,
									multiFolder: false,
									folderClick: function(obj, folder) {
										var $selectFolder = $(".selectedFolder");
										if ($selectFolder.length > 0) {
											$selectFolder.attr("class", "");
										}
										$(obj).attr("class", "selectedFolder");
										selectedFolder = folder;
									}
								},
								function(file) {
									selectedFile = file;
									$(".selectedFile").attr("class", "");
									$("a[rel='" + file + "']").attr("class", "selectedFile");
								});
								
								var dashboardFolder = CDFDDFileName.substring(1, CDFDDFileName.lastIndexOf('/') + 1);
								var foldersToSelect = [];
								var tmp = '';
								$.each(dashboardFolder.substring(0, dashboardFolder.length - 1).split('/'), function(i, elem) {
									tmp += elem + '/';
									foldersToSelect.push(tmp);
								});
								
								$.each(foldersToSelect, function(i, folderToSelect) {
									$('.jqueryFileTree').find('.directory.collapsed').each(function (i, folder) {
										var folderLink = $(folder).children();
										if (folderToSelect.indexOf(folderLink.attr('rel')) === 0) {
											folderLink.click();
										}
									});
								});
							}
						});
					}
				} else {
					alert('Please select an SVG file (*.svg).');
				}
			} else {
				alert('Local files selection is not supported by the current browser.');
			}
		});

		_repoFileExplorer.bind('click', function() {

			var repoFileExplorerLabel = 'Choose existing file' + (myself.createNew ? ', or select a folder to create one' : '');
			var repoFileExplorerContent = CDFDDUtils.wrapPopupTitle('') +
				CDFDDUtils.wrapPopupBody('<div class="popup-label">' + repoFileExplorerLabel + '</div>\n' +
				'<div id="container_id" class="urltargetfolderexplorer"></div>\n');

			var newFileContent = CDFDDUtils.wrapPopupTitle('Create File') +
				CDFDDUtils.wrapPopupBody(
				'<div class="popup-input-container bottom">\n' +
				'  <div class="popup-label">New File</div>\n' +
				'  <input class="popup-text-input" name="fileName"/>' +
				'</div>\n', 'layout-popup');

			var selectedFile = "";
			var selectedFolder = "";

			var openOrNew = {
				browse: {// file explorer
					html: repoFileExplorerContent,
					buttons: {
						Ok: true,
						Cancel: false
					},
					opacity: 0.2,
					submit: function(v, m, f) {
						if(v) {
							if(selectedFile.length > 0) {
								myself.fileName = selectedFile;
								var file = myself.formatSelection(selectedFile);
								_editArea.text(file);
								myself.callback(file);
								return true;
							} else if(selectedFolder.length > 0) {
								if(myself.createNew) {
									$.prompt.goToState('newFile');
								}
								return false;
							}
						}
						return true;
					}
				},

				newFile: {// new file prompt when folder selected
					html: newFileContent,
					buttons: {
						Ok: true,
						Cancel: false
					},
					submit: function(v, m, f) {
						if(v) {
							//new file
							selectedFile = selectedFolder + f.fileName;

							//check extension
							var ext = selectedFile.substring(selectedFile.lastIndexOf('.') + 1);
							if('.' + ext !== myself.getFileExtensions()) {
								selectedFile += myself.getFileExtensions();
							}

							myself.fileName = selectedFile;
							var file = myself.formatSelection(selectedFile);
							_editArea.text(file);
							var params = {
								createNew: true,
								path: selectedFile,
								data: ""
							};
							SynchronizeRequests.createFile(params);
							myself.callback(file);
							return true;
						} else {
							$.prompt.goToState('browse');
							return false;
						}
					}
				}
			};

			CDFDDUtils.prompt(openOrNew, {
				opacity: '0.2',
				prefix: "popup",
				loaded: function() {
					selectedFile = "";

					var $this = $(this);
					$this.addClass('choose-file-popup');
					CDFDDUtils.movePopupButtons($this.find('#popup_state_browse'));
					CDFDDUtils.movePopupButtons($this.find('#popup_state_newFile'));

					$('#container_id').fileTree({
						root: '/',
						script: SolutionTreeRequests.getExplorerFolderEndpoint(CDFDDDataUrl) + "?fileExtensions=" + fileExtensions + "&showHiddenFiles=true" + (CDFDDFileName != "" ? "&dashboardPath=" + CDFDDFileName : ""),
						expandSpeed: 1000,
						collapseSpeed: 1000,
						multiFolder: false,
						folderClick: function(obj, folder) {
							var $selectFolder = $(".selectedFolder");
							if($selectFolder.length > 0) {
								$selectFolder.attr("class", "");
							}
							$(obj).attr("class", "selectedFolder");
							selectedFolder = folder; //TODO:
						}
					},
					function(file) {
						selectedFile = file;
						$(".selectedFile").attr("class", "");
						$("a[rel='" + file + "']").attr("class", "selectedFile");
					});
				}
			});

		});
		
		content.appendTo(placeholder);
	},

	getFileExtensions: function() {
		return ".svg";
	},

	getResourceType: function() {
		return 'svg';
	}
});

var LegendRenderer = CellRenderer.extend({
	
	//default values for selectors
	defaultValueType: 'Numeric',
	defaultStatMethod: 'User defined classification',
	defaultColorTheme: 'Manual',
	defaultAutoLabels: false,
	defaultInverse: false,
	
	cssPrefix: "StringList",
	valueTypes: ['Numeric', 'Nominal'],
	statMethods: ['User defined classification', 'Unique values', 'Equal intervals', 'Quantiles', 'Standard deviation', 'Jenks natural breaks', 'K-means', 'Arithmetic progression', 'Geometric progression'],
	colorThemes: {
		'Manual': '',
		'Yellow - Red': ['#FFFFCC', '#FFE6B4', '#FFC696', '#FFA176', '#FF7755', '#E05544', '#CC3333', '#990000', '#660000'],
		'Green': ['#F7FCF5', '#E5F5E0', '#C7E9C0', '#A1D99B', '#74C476', '#41AB5D', '#238B45', '#006D2C', '#00441B'],
		'Yellow - Purple': ['#FFF6DD', '#F5E5D5', '#E9CFCA', '#DBB8BF', '#CB9FB2', '#BB84A6', '#AA6998', '#984D8A', '#852E7C'],
		'Grey': ['#F1F1F1', '#E1E1E1', '#CECECE', '#B8B8B8', '#A1A1A1', '#8A8A8A', '#727272', '#5B5B5B', '#444444'],
		'Blue - White - Red': ['#0000FF', '#5F5FFF', '#8F8FFF', '#BFBFFF', '#FFFFFF', '#FFBFBF', '#FF8F8F', '#FF5F5F', '#FF0000']
	},

	//used for value input labels
	popupTitle: 'Legend Items',
	valueTypeTitle: 'Value type',
	statMethodTitle: 'Statistical method',
	colorThemeTitle: 'Color theme',
	autoLabelsCheckboxTitle: 'Auto labels',
	inverseColorThemeCheckboxTitle: 'Inverse',
	labelTitle: 'Label',
	minTitle: 'Min',
	maxTitle: 'Max',
	colorTitle: 'Color',
	
	textPlaceHolderText: 'Insert Text...',
	numberPlaceHolderText: 'Insert Number...',
	colorPlaceHolderText: 'Name / Hexa',

	index: 0,

	constructor: function(tableManager) {
		this.base(tableManager);
		this.logger = new Logger("LegendRenderer");
		this.logger.debug("Creating new LegendRenderer");
	},

	render: function(placeholder, value, callback) {
		var myself = this;
		var _editArea = $("<td></td>");
		_editArea.text(value.length > 30 ? (value.substring(0, 20) + " (...)") : value);

		_editArea.click(function() {
			var content = myself.getPopupContent();
			var htmlContent = $('<div>').append(content).html();
			var selectedType = myself.defaultValueType;
			var selectedMethod = myself.defaultStatMethod;
			var selectedTheme = myself.defaultColorTheme;
			var autoLabels = myself.defaultAutoLabels;
			var inverse = myself.defaultInverse;
			var vals = JSON.parse(value);
			
			if (_.isEmpty(vals)) {
				vals = [["", "", "", ""]];
			} else {
				selectedType = vals.shift();
				selectedMethod = vals.shift();
				selectedTheme = vals.shift();
				autoLabels = vals.shift();
				inverse = vals.shift();
			}
			
			var index = myself.index = vals.length;

			cdfdd.arrayValue = vals;

			CDFDDUtils.prompt(htmlContent, {
				callback: function(v, m, f) {
					if (v) {
						var result = cdfdd.arrayValue;
						// A bit of a hack to make null happen
						result = result.replace(/"null"/g, "null");
						callback(result);
						_editArea.text(result);
					}
					
					delete cdfdd.arrayValue;
				},

				loaded: function() {
					$('.popup-body-container').css('height', '492px');
					
					for (var i = 0; i < index; i++) {
						myself.addPopupRow(i, vals[i], $('.popup-list-body'));
					}
					
					myself.popupLoadedCallback($(this));
					
					$('#valueType option').filter(function() {
						return ($(this).text() == selectedType);
					}).prop('selected', true).change();
					
					$('#statMethod option').filter(function() {
						return ($(this).text() == selectedMethod);
					}).prop('selected', true).change();
					
					$('#colorTheme option').filter(function() {
						return ($(this).text() == selectedTheme);
					}).prop('selected', true).change();
					
					$('#autoLabels').prop('checked', autoLabels).change();
					$('#inverseColorTheme').prop('checked', inverse).change();
					
					//focus on the first available input field
					$('.popup-text-input:enabled:first').focus();
				},

				submit: function(v, m, f) {
					if (v) {
						myself.popupSubmitCallback();
					}
				}
			});
		});

		_editArea.appendTo(placeholder);
	},

	getPopupContent: function() {
		var cssPrefix = this.cssPrefix;
		var rv = "";
		var re = new RegExp("MSIE ([0-9]{1,}[\.0-9]{0,})");
		
		if (re.exec(navigator.userAgent) != null) {
			rv = parseFloat(RegExp.$1) < 10 ? "ie8" : "";
		}

		var popupHeader = '' +
			'<div class="popup-header-container">\n' +
			'  <div class="popup-title-container">' + this.popupTitle + '</div>\n' +
			'</div>\n';
		
		var valueTypeSelector = this.getValueTypeSelector();
		var statMethodSelector = this.getStatMethodSelector();
		var colorThemeSelector = this.getColorThemeSelector();

		var addRowButton = '' +
			'<div class="popup-list-buttons add-button-container">\n' +
			'  <button class="popup-add-row-button">Add</button>\n' +
			'</div>\n';

		var removeRowButtons = '' +
			'<div class="popup-list-buttons remove-selection-button-container">\n' +
			'  <button class="popup-remove-selection">Remove</button>\n' +
			'  <button class="popup-cancel-selection">Cancel</button>\n' +
			'</div>';

		var rowListHeaders = this.getRowListHeaders();

		var popupBody = CDFDDUtils.wrapPopupBody(
			'<div class="popup-body-header clearfix">' + valueTypeSelector + statMethodSelector + colorThemeSelector + addRowButton + removeRowButtons + rowListHeaders + '</div>' +
			'<div class="popup-list-body"></div>\n', 'popup-list-body-container popup-add-mode');
		return $(popupHeader + popupBody);
	},

	getRowListHeaders: function() {
		var columnStyle = 'style="width: 23%; float: left; margin: 0 1px;"';
		var html = '<div class="popup-label" ' + columnStyle + '>' + this.labelTitle + '</div>' +
			'<div class="popup-label" ' + columnStyle + '>' + this.minTitle + '</div>' +
			'<div class="popup-label" ' + columnStyle + '>' + this.maxTitle + '</div>' +
			'<div class="popup-label" ' + columnStyle + '>' + this.colorTitle + '</div>';

		return html === "" ? html : '<div class="popup-list-row-label">' + html + '</div>';
	},

	popupLoadedCallback: function(popupObj) {
		popupObj.addClass(this.cssPrefix + 'Popup array-list-popup');

		this.onPopupLoad();

		/* Bind Events */
		this.valueTypeChangeEvent();
		this.statMethodChangeEvent();
		this.colorThemeChangeEvent();
		this.autoLabelsChangeEvent();
		this.inverseChangeEvent();
		this.colorChangeEvent('.color-input');
		this.addRowButtonEvent();
		this.removeSelectedRowsEvent();
		this.cancelRowSelectionEvent();
		this.selectRowToRemoveEvent('.popup-remove-row-select');
		this.labelHoverEvent('.label-input');
		this.dragAndDropHoverEvent('.popup-drag-icon');
		this.dragAndDrop();
		this.sortEvent();
		this.handleOverflow();
	},

	popupSubmitCallback: function() {
		var myself = this;
		var array = [];
		
		$('.popup-list-row').each(function() {
			var index = $(this).attr('id').replace('parameters_', '');
			var item = myself.getRowValues(index);
			
			if (!myself.checkColor(item[3])) {
				item[3] = '';
			}
			
			if (!myself.isItemInvalid(item)) {
				array.push(item); //don't attempt to add deleted lines
			}
		});

		if (array.length > 0) {
			var selectedType = $('#valueType').val();
			var selectedMethod = $('#statMethod').val();
			var selectedTheme = $('#colorTheme').val();
			var autoLabels = $('#autoLabels').prop('checked');
			var inverse = $('#inverseColorTheme').prop('checked');
			
			array.unshift(selectedType, selectedMethod, selectedTheme, autoLabels, inverse);
			cdfdd.arrayValue = JSON.stringify(array);
		} else {
			cdfdd.arrayValue = '[]';
		}
	},

	//region Popup Events
	valueTypeChangeEvent: function() {
		var myself = this;
		
		$('#valueType').change(function() {
			if ($(this).val() == myself.defaultValueType) {
				$('#autoLabels').prop('disabled', false);
				$('#statMethod').prop('disabled', false);
			} else {
				$('#autoLabels').prop('disabled', true).prop('checked', false).change();
				$('#statMethod').prop('disabled', true);
				$('#statMethod option').filter(function() {
					return ($(this).text() == myself.defaultStatMethod);
				}).prop('selected', true);
			}
			
			myself.handleLimits();
			myself.revalidateLimits();
		});
	},
	
	statMethodChangeEvent: function() {
		var myself = this;
		
		$('#statMethod').change(function() {
			myself.handleLimits();
			myself.revalidateLimits();
		});
	},
	
	colorThemeChangeEvent: function() {
		var myself = this;
				
		$('#colorTheme').change(function() {
			myself.handleInverse();
			myself.affectColors();
		});
	},
	
	autoLabelsChangeEvent: function() {
		var myself = this;
		
		$('#autoLabels').change(function() {
			myself.handleLabels('.label-input');
		});
	},
	
	inverseChangeEvent: function() {
		var myself = this;
		
		$('#inverseColorTheme').change(function() {
			myself.affectColors();
		});
	},

	colorChangeEvent: function(selector) {
		var myself = this;
		
		$(selector).change(function() {
			var id = $(this).attr('id').replace('color_', '');
			var val = $(this).val();
			var ok = myself.checkColor(val);
			var tooltip = 'Please enter a correct color name / code.';
			
			$('#colorRep_' + id).css('background-color', ok ? val : '');
			$(this)[0].setCustomValidity(ok ? '' : tooltip);
			myself.handleOkButton();
		});
		
		$(selector).focusout(function() {
			$(this).change();
		});
	},
	
	addRowButtonEvent: function() {
		var myself = this;
		
		$('.popup-add-row-button').click(function() {
			var index = myself.index++;

			myself.addPopupRow(index, ["", "", "", ""], $('.popup-list-body'));

			//events
			myself.handleOverflow();
			myself.colorChangeEvent('#color_' + index);
			myself.handleLabels('#label_' + index);
			myself.handleLimits();
			myself.revalidateLimits();
			myself.revalidateColors();
			myself.affectColors();
			myself.selectRowToRemoveEvent("#remove_button_" + index);
			myself.labelHoverEvent('#label_' + index);
			myself.dragAndDropHoverEvent("#drag_icon_" + index);
		});
	},

	removeSelectedRowsEvent: function() {
		var myself = this;

		$('.popup-remove-selection').click(function() {
			var mainContainer = $('.popup-list-body-container');

			$('.popup-remove-selected').remove();
			mainContainer.addClass('popup-add-mode');
			mainContainer.removeClass('popup-remove-mode');

			myself.handleOverflow();
			myself.revalidateLimits();
			myself.affectColors();
			myself.handleOkButton();
		});
	},

	cancelRowSelectionEvent: function() {
		var myself = this;
		
		$('.popup-cancel-selection').click(function() {
			var removeSelClass = 'popup-remove-selected';
			var mainContainer = $('.popup-list-body-container');
			var rows = $('.' + removeSelClass);

			rows.removeClass(removeSelClass);
			rows.find('.popup-text-input').prop('disabled', false);
			mainContainer.addClass('popup-add-mode');
			mainContainer.removeClass('popup-remove-mode');
		});
	},

	selectRowToRemoveEvent: function(selector) {
		var myself = this;
		
		$(selector).click(function() {
			var placeholder = $(this).parents('.popup-list-row');
			var possibleInputs = placeholder.find('.popup-text-input');
			var removeSelClass = 'popup-remove-selected';
			var state = possibleInputs.prop('disabled');

			placeholder.toggleClass(removeSelClass);
			possibleInputs.prop('disabled', !state);

			var mainContainer = $('.popup-list-body-container');
			var isRemoving = !!mainContainer.has('.' + removeSelClass).length;

			mainContainer.toggleClass('popup-add-mode', !isRemoving);
			mainContainer.toggleClass('popup-remove-mode', isRemoving);
		}).hover(function() {
			$(this).parents('.popup-list-row').addClass('popup-remove-hover');
		}, function() {
			$(this).parents('.popup-list-row').removeClass('popup-remove-hover');
		});
	},
	
	labelHoverEvent: function(selector) {
		$(selector).hover(function() {
			if ($(this)[0].offsetWidth < $(this)[0].scrollWidth) {
				$(this).attr('title', $(this).val());
			} else {
				$(this).attr('title', '');
			}
		});
	},

	dragAndDropHoverEvent: function(selector) {
		$(selector).hover(function() {
			var container = $(this).parents('.popup-list-row');

			container.find('input').blur();
			container.addClass('popup-drag-hover');
		}, function() {
			var container = $(this).parents('.popup-list-row');
			container.removeClass('popup-drag-hover');
		});
	},
	
	sortEvent: function() {
		var myself = this;
		
		$('.popup-list-body').on('sortupdate', function(event, ui) {
			myself.revalidateLimits();
			myself.affectColors();
		});
	},
	
	onPopupLoad: function() {
		//custom renderers may want to do something on popup load, this is here just as a hook
	},

	postAddRow: function() {
		//default does nothing
	},
	//endregion

	//region Utils Functions
	validate: function(settings, original) {
		return true;
	},

	isItemInvalid: function(item) {
		if (item == null || _.isEmpty(item)) {
			return true;
		}
		
		return _.isEmpty(item[3]);
	},

	sanitizeValues: function(values) {
		for (var i = 0; i < values.length; i++) {
			values[i] = values[i] === undefined ? "" : values[i] === null ? "null" : values[i];
		}

		return values;
	},

	getRowValues: function(i) {
		var result = [];

		result.push($('#label_' + i).val());
		result.push($('#min_' + i).val());
		result.push($('#max_' + i).val());
		result.push($('#color_' + i).val());

		return result;
	},

	handleOverflow: function() {
		var container = $('.popup-list-body');

		if (!container.length) {
			return;
		}

		var element = container.get(0);
		
		if (element.offsetHeight < element.scrollHeight) {
			container.addClass('overflow-container');
		} else {
			container.removeClass('overflow-container');
		}
	},
	
	handleInverse: function() {
		var theme = $('#colorTheme').val();
		$('#inverseColorTheme').prop('disabled', theme == this.defaultColorTheme);
	},
	
	handleLabels: function(selector) {
		if ($('#autoLabels').prop('checked')) {
			$(selector).prop('disabled', true).val('');
		} else {
			$(selector).prop('disabled', false);
		}
	},
	
	handleLimits: function() {
		var myself = this;
		var type = $('#valueType').val();
		var method = $('#statMethod').val();
		
		// A bit of a hack to deal with changes between a string and empty (not captured by default validation mecanism)
		$('.limit-input').focusout(function() {
			$(this).change();
		});
		
		if (type == this.defaultValueType) {
			if (method == this.defaultStatMethod) {
				$('.limit-input').prop('disabled', false);
				
				var tooltipNumber = 'Please enter a number.';
				var tooltipMinMax = 'Please enter a min value less than the max value.';
				var tooltipMaxMin = 'Please enter a max value greater than the min value.';
				var tooltipMinPrevMax = 'Please enter a min value greater than or equal to the previous max value.';
				var tooltipMaxNextMin = 'Please enter a max value less than or equal to the next min value.';
				
				$('.min-input').change(function() {
					var min = $(this).val();
					var id = $(this).attr('id').replace('min_', '');
					var maxInput = $('#max_' + id);
					var max = maxInput.val();
					
					var row = $(this).parents('.popup-list-row');
					
					var prevRow = row.prev('.popup-list-row');
					var prevMaxInput = prevRow.find('.max-input');
					var prevMax = prevMaxInput.val();
					var prevMin = prevRow.find('.min-input').val();
					
					var nextRow = row.next('.popup-list-row');
					var nextMin = nextRow.find('.min-input').val();
								
					if ($.isNumeric(min)) {
						if ($.isNumeric(prevMax)) {
							var warnPrevLimitsCase = $.isNumeric(prevMin) && parseFloat(prevMin) >= parseFloat(prevMax);
							
							if (parseFloat(min) < parseFloat(prevMax)) {
								$(this)[0].setCustomValidity(tooltipMinPrevMax);
								
								if (!warnPrevLimitsCase) {
									prevMaxInput[0].setCustomValidity(tooltipMaxNextMin);
								}
							} else {
								if (!warnPrevLimitsCase) {
									prevMaxInput[0].setCustomValidity('');
								}
							}
						}
						
						if ($.isNumeric(max)) {
							if (parseFloat(max) <= parseFloat(min)) {
								$(this)[0].setCustomValidity(tooltipMinMax);
								maxInput[0].setCustomValidity(tooltipMaxMin);
							} else {
								if ($.isNumeric(nextMin) && parseFloat(max) > parseFloat(nextMin)) {
									maxInput[0].setCustomValidity(tooltipMaxNextMin);
								} else {
									maxInput[0].setCustomValidity('');
								}
							}
						}
						
						var warnCase1 = $.isNumeric(prevMax) && parseFloat(min) < parseFloat(prevMax);
						var warnCase2 = $.isNumeric(max) && parseFloat(max) <= parseFloat(min);
						
						if (!warnCase1 && !warnCase2) {
							$(this)[0].setCustomValidity('');
						}
					} else {
						var firstMinId = $('.min-input').first().attr('id').replace('min_', '');
						var lastMaxId = $('.max-input').last().attr('id').replace('max_', '');
						
						$(this)[0].setCustomValidity(id == firstMinId ? '' : tooltipNumber);
						
						if (!($.isNumeric(prevMin) && $.isNumeric(prevMax) && parseFloat(prevMin) >= parseFloat(prevMax))) {
							if (prevMax) {
								var prevMaxId = prevMaxInput.attr('id').replace('max_', '');
								prevMaxInput[0].setCustomValidity($.isNumeric(prevMax) || prevMaxId == lastMaxId ? '' : tooltipNumber);
							}
						}
						
						if ($.isNumeric(max) && $.isNumeric(nextMin) && parseFloat(max) > parseFloat(nextMin)) {
							maxInput[0].setCustomValidity(tooltipMaxNextMin);
						} else {
							maxInput[0].setCustomValidity($.isNumeric(max) || id == lastMaxId ? '' : tooltipNumber);
						}
					}
					
					myself.handleOkButton();
				});
				
				$('.max-input').change(function() {
					var max = $(this).val();
					var id = $(this).attr('id').replace('max_', '');
					var minInput = $('#min_' + id);
					var min = minInput.val();
					
					var row = $(this).parents('.popup-list-row');
					
					var nextRow = row.next('.popup-list-row');
					var nextMinInput = nextRow.find('.min-input');
					var nextMin = nextMinInput.val();
					var nextMax = nextRow.find('.max-input').val();
					
					var prevRow = row.prev('.popup-list-row');
					var prevMax = prevRow.find('.max-input').val();
					
					if ($.isNumeric(max)) {
						if ($.isNumeric(nextMin)) {
							var warnNextLimitsCase = $.isNumeric(nextMax) && parseFloat(nextMin) >= parseFloat(nextMax);
							
							if (parseFloat(max) > parseFloat(nextMin)) {
								$(this)[0].setCustomValidity(tooltipMaxNextMin);
								
								if (!warnNextLimitsCase) {
									nextMinInput[0].setCustomValidity(tooltipMinPrevMax);
								}
							} else {
								if (!warnNextLimitsCase) {
									nextMinInput[0].setCustomValidity('');
								}
							}
						}
						
						if ($.isNumeric(min)) {
							if (parseFloat(min) >= parseFloat(max)) {
								$(this)[0].setCustomValidity(tooltipMaxMin);
								minInput[0].setCustomValidity(tooltipMinMax);
							} else {
								if ($.isNumeric(prevMax) && parseFloat(prevMax) > parseFloat(min)) {
									minInput[0].setCustomValidity(tooltipMinPrevMax);
								} else {
									minInput[0].setCustomValidity('');
								}
							}
						}
						
						var warnCase1 = $.isNumeric(nextMin) && parseFloat(max) > parseFloat(nextMin);
						var warnCase2 = $.isNumeric(min) && parseFloat(min) >= parseFloat(max);
						
						if (!warnCase1 && !warnCase2) {
							$(this)[0].setCustomValidity('');
						}
					} else {
						var firstMinId = $('.min-input').first().attr('id').replace('min_', '');
						var lastMaxId = $('.max-input').last().attr('id').replace('max_', '');
						
						$(this)[0].setCustomValidity(id == lastMaxId ? '' : tooltipNumber);
						
						if (!($.isNumeric(nextMin) && $.isNumeric(nextMax) && parseFloat(nextMin) >= parseFloat(nextMax))) {
							if (nextMin) {
								var nextMinId = nextMinInput.attr('id').replace('min_', '');
								nextMinInput[0].setCustomValidity($.isNumeric(nextMin) || nextMinId == firstMinId ? '' : tooltipNumber);
							}
						}
						
						if ($.isNumeric(min) && $.isNumeric(prevMax) && parseFloat(prevMax) > parseFloat(min)) {
							minInput[0].setCustomValidity(tooltipMinPrevMax);
						} else {
							minInput[0].setCustomValidity($.isNumeric(min) || id == firstMinId ? '' : tooltipNumber);
						}
					}
					
					myself.handleOkButton();
				});
			} else if (method == 'Unique values') {
				$('.min-input').prop('disabled', false);
				$('.max-input').prop('disabled', true).val('');
				
				var tooltipNumber = 'Please enter a number.';
				var tooltipPrev = 'Please enter a value greater than the previous value.';
				var tooltipNext = 'Please enter a value less than the next value.';
				
				$('.min-input').change(function() {
					var val = $(this).val();
					var id = $(this).attr('id').replace('min_', '');
					
					var row = $(this).parents('.popup-list-row');
					
					var prevRow = row.prev('.popup-list-row');
					var prevInput = prevRow.find('.min-input');
					var prev = prevInput.val();
					
					var prev2Row = prevRow.prev('.popup-list-row');
					var prev2Input = prev2Row.find('.min-input');
					var prev2 = prev2Input.val();
					
					var nextRow = row.next('.popup-list-row');
					var nextInput = nextRow.find('.min-input');
					var next = nextInput.val();
					
					var next2Row = nextRow.next('.popup-list-row');
					var next2Input = next2Row.find('.min-input');
					var next2 = next2Input.val();
					
					if ($.isNumeric(val)) {
						if ($.isNumeric(prev)) {
							if (parseFloat(val) <= parseFloat(prev)) {
								$(this)[0].setCustomValidity(tooltipPrev);
								prevInput[0].setCustomValidity(tooltipNext);
							} else {
								if ($.isNumeric(prev2) && parseFloat(prev2) >= parseFloat(prev)) {
									prevInput[0].setCustomValidity(tooltipPrev);
								} else {
									prevInput[0].setCustomValidity('');
								}
							}
						}
						
						if ($.isNumeric(next)) {
							if (parseFloat(next) <= parseFloat(val)) {
								$(this)[0].setCustomValidity(tooltipNext);
								nextInput[0].setCustomValidity(tooltipPrev);
							} else {
								if ($.isNumeric(next2) && parseFloat(next) >= parseFloat(next2)) {
									nextInput[0].setCustomValidity(tooltipNext);
								} else {
									nextInput[0].setCustomValidity('');
								}
							}
						}
						
						var warnCase1 = $.isNumeric(prev) && parseFloat(val) <= parseFloat(prev);
						var warnCase2 = $.isNumeric(next) && parseFloat(next) <= parseFloat(val);
						
						if (!warnCase1 && !warnCase2) {
							$(this)[0].setCustomValidity('');
						}
					} else {
						$(this)[0].setCustomValidity(tooltipNumber);
						
						if (prev) {
							if ($.isNumeric(prev2) && $.isNumeric(prev) && parseFloat(prev2) >= parseFloat(prev)) {
								prevInput[0].setCustomValidity(tooltipPrev);
							} else {
								prevInput[0].setCustomValidity($.isNumeric(prev) ? '' : tooltipNumber);
							}
						}
						
						if (next) {
							if ($.isNumeric(next) && $.isNumeric(next2) && parseFloat(next) >= parseFloat(next2)) {
								nextInput[0].setCustomValidity(tooltipNext);
							} else {
								nextInput[0].setCustomValidity($.isNumeric(next) ? '' : tooltipNumber);
							}
						}
					}
					
					myself.handleOkButton();
				});
			} else {
				$('.limit-input').prop('disabled', true).val('');
			}
		} else {
			$('.limit-input').prop('disabled', true).val('');
		}
	},
	
	handleOkButton: function() {
		var limitsValid = this.checkLimitsValidity();
		var colorsValid = this.checkColorsValidity();
		var valid = limitsValid && colorsValid;
		$('#popup_state0_buttonOk').prop('disabled', !valid).css(valid ? {'opacity': '', 'pointer-events': ''} : {'opacity': 0.5, 'pointer-events': 'none'});
	},
	
	checkLimitsValidity: function() {
		var ok = true;
		
		$('.limit-input').each(function() {
			if (!$(this)[0].checkValidity()) {
				ok = false;
				return false;
			}
		});
		
		return ok;
	},
	
	checkColorsValidity: function() {
		var ok = true;
		
		$('.color-input').each(function() {
			if (!$(this)[0].checkValidity()) {
				ok = false;
				return false;
			}
		});
		
		return ok;
	},
	
	revalidateLimits: function() {
		var type = $('#valueType').val();
		var method = $('#statMethod').val();
		
		if (type == this.defaultValueType) {
			if (method == this.defaultStatMethod) {
				$('.limit-input').change();
			} else if (method == 'Unique values') {
				$('.min-input').change();
			}
		}
		
		this.handleOkButton();
	},
	
	revalidateColors: function() {
		var theme = $('#colorTheme').val();
		
		if (theme == this.defaultColorTheme) {
			$('.color-input').change();
		}
	},
	
	affectColors: function() {
		var themes = this.colorThemes;
		var theme = $('#colorTheme').val();
		var inverse = $('#inverseColorTheme').prop('checked');
		var nb_classes = $('.color-input').length;
		
		$('.color-input').prop('disabled', theme != this.defaultColorTheme);
		
		if (themes.hasOwnProperty(theme) && theme != this.defaultColorTheme) {
			var themeColors = themes[theme];
			var colors = this.pickColors(themeColors, nb_classes, inverse);
			
			$('.color-input').each(function(i, input) {
				$(this).val(colors[i]).change();
			});
		}
	},
	
	pickColors: function(themeColors, nb_classes, inverse) {
		var colors = [];
		var n = themeColors.length;
		
		if (n > 0) {
			if (nb_classes > n) {
				nb_classes = n;
			} else if (nb_classes < 1) {
				nb_classes = 1;
			}
			
			var array = this.balancedArray(n);
			
			if (nb_classes < n) {
				array = array.slice(0, nb_classes);
			}
			
			array.sort(function(a, b) {
				return a - b;
			});
			
			if (inverse) {
				array.reverse();
			}
			
			for (var i = 0; i < nb_classes; i++) {
				colors.push(themeColors[array[i]]);
			}
		}
		
		return colors;
	},
	
	balancedArray: function(n) {
		var array = [];
		
		if (n == 1) {
			array.push(0);
		} else if (n == 2) {
			array.push(0, 1);
		} else if (n > 2) {
			var first = 0;
			var last = n - 1;
			var medium = this.average(first, last);
			var rest = [];
			
			for (var i = 0; i < n; i++) {
				rest.push(i);
			}
			
			this.arrayTransfer(rest, array, first);
			this.arrayTransfer(rest, array, last);
			this.arrayTransfer(rest, array, medium);
			
			if (n % 2 === 0) {
				this.arrayTransfer(rest, array, last - medium);
			}
			
			if (rest.length > 0) {
				var m = this.average(first, medium);
				
				if (typeof m === 'number') {
					this.arrayTransfer(rest, array, m);
					this.arrayTransfer(rest, array, last - m);
				}
				
				if (rest.length === 1) {
					this.arrayTransfer(rest, array, rest[0]);
				} else if (rest.length > 1) {
					var k = rest.length / 2;
					while (k--) {
						var x = rest[k];
						this.arrayTransfer(rest, array, x);
						this.arrayTransfer(rest, array, last - x);
					}
				}
			}
		}
		
		return array;
	},
	
	average: function(a, b) {
		var medium = Math.floor((a + b) / 2);
		return medium == a ? '' : medium;
	},
	
	arrayTransfer: function(ar1, ar2, x) {
		ar2.push(x);
		ar1.splice(ar1.indexOf(x), 1);
	},
	//endregion

	//region Drag&Drop Functions
	dragAndDrop: function() {
		var myself = this;
		
		$('div.popup .popup-list-body').sortable({
			axis: 'y',
			cursor: 'auto',
			placeholder: 'popup-sortable-holder',
			delay: 100,
			sort: function(event, ui) {
				var a = "";
			}
		});
	},
	//endregion

	//region UI Functions
	getValueTypeSelector: function() {
		var valueTypeOptions = '';
		
		$.each(this.valueTypes, function(i, type) {
			valueTypeOptions += '<option>' + type + '</option>\n';
		});

		return '' +
			'<div style="margin: 0 0 5px 0;">' +
			'  <div class="popup-label" style="width: 25%; float: left; margin: 0.5em 2px;">' + this.valueTypeTitle + '</div>' +
			'  <div style="display: inline-block;">\n' +
			'    <select id="valueType" class="popup-select type-select">' + valueTypeOptions + '</select>' +
			'  </div>\n' +
			'  <input id="autoLabels" type="checkbox" style="float: right; margin: 0.5em 10% 0.5em 5px;">' +
			'  <label for="autoLabels" class="popup-label" style="float: right; margin: 0.5em 2px;">' + this.autoLabelsCheckboxTitle + '</label>' +
			'</div>';
	},
	
	getStatMethodSelector: function() {
		var statMethodOptions = '';
		
		$.each(this.statMethods, function(i, method) {
			statMethodOptions += '<option>' + method + '</option>\n';
		});

		return '' +
			'<div style="margin: 0 0 5px 0;">' +
			'  <div class="popup-label" style="width: 25%; float: left; margin: 0.5em 2px;">' + this.statMethodTitle + '</div>' +
			'  <div>\n' +
			'    <select id="statMethod" class="popup-select type-select">' + statMethodOptions + '</select>' +
			'  </div>\n' +
			'</div>';
	},
	
	getColorThemeSelector: function() {
		var colorThemeOptions = '';
		
		for (var th in this.colorThemes) {
			colorThemeOptions += '<option>' + th + '</option>\n';
		}

		return '' +
			'<div style="margin: 0 0 15px 0;">' +
			'  <div class="popup-label" style="width: 25%; float: left; margin: 0.5em 2px;">' + this.colorThemeTitle + '</div>' +
			'  <div style="display: inline-block;">\n' +
			'    <select id="colorTheme" class="popup-select type-select">' + colorThemeOptions + '</select>' +
			'  </div>\n' +
			'  <input id="inverseColorTheme" type="checkbox" style="float: right; margin: 0.5em 10% 0.5em 5px;">' +
			'  <label for="inverseColorTheme" class="popup-label" style="float: right; margin: 0.5em 2px;">' + this.inverseColorThemeCheckboxTitle + '</label>' +
			'</div>';
	},
	
	addPopupRow: function(index, values, container) {
		values = this.sanitizeValues(values);
		
		var row = this.buildMultiDimensionRow.apply(this, [index].concat(values));

		container.append(row);
		container.find('#parameters_' + index + ' input:eq(0)').focus();

		this.postAddRow(container, index);
	},

	buildMultiDimensionRow: function(index, label, min, max, color) {
		var labelSection = this.getLabelSection(index, label);
		var minSection = this.getMinSection(index, min);
		var maxSection = this.getMaxSection(index, max);
		var colorSection = this.getColorSection(index, color);

		return this.wrapPopupRow(index, 'multi-dimension-row', labelSection + minSection + maxSection + colorSection);
	},
	
	wrapPopupRow: function(index, cssClass, html) {
		var removeButton = this.getRemoveRowButton(index);
		var dragIcon = this.getDragIcon(index);

		return '' +
			'<div id="parameters_' + index + '" class="popup-list-row ' + cssClass + '">' +
			removeButton + html + dragIcon + '</div>';
	},

	getRemoveRowButton: function(index) {
		return '<span id="remove_button_' + index + '" class="popup-remove-row-select"></span>';
	},

	getLabelSection: function(index, value) {
		return '' +
			'<div style="width: 23%; float: left; margin: 0 1px;">' +
			'  <input id="label_' + index + '" class="popup-text-input value-input label-input" type="text" value="' + value + '" placeholder="' + this.textPlaceHolderText +'">' +
			'</div>';
	},

	getMinSection: function(index, value) {
		return '' +
			'<div style="width: 23%; float: left; margin: 0 1px;">' +
			'  <input id="min_' + index + '" class="popup-text-input value-input limit-input min-input" type="number" step="any" style="text-align: right;" value="' + value + '" placeholder="' + this.numberPlaceHolderText + '">' +
			'</div>';
	},

	getMaxSection: function(index, value) {
		return '' +
			'<div style="width: 23%; float: left; margin: 0 1px;">' +
			'  <input id="max_' + index + '" class="popup-text-input value-input limit-input max-input" type="number" step="any" style="text-align: right;" value="' + value + '" placeholder="' + this.numberPlaceHolderText + '">' +
			'</div>';
	},

	getColorSection: function(index, value) {
		return '' +
			'<div style="width: 23%; float: left; margin: 0 1px;">' +
			'  <input id="color_' + index + '" class="popup-text-input value-input color-input" type="text" style="text-align: right;" value="' + value + '" placeholder="' + this.colorPlaceHolderText + '">' +
			'</div>' +
			'<div id="colorRep_' + index + '" style="width: 6%; min-height: 100%; float: left; margin: 0 1px; background-color: ' + (this.checkColor(value) ? value : '') + ';" />';
	},
	
	checkColor: function(color) {
		var tmp = $('<div style="background-color: ' + color + ';">');
		var checkedColor = tmp.css('background-color');
		return (checkedColor != 'transparent') && (checkedColor != 'rgba(0, 0, 0, 0)') && (checkedColor != '');
	},

	getDragIcon: function(index) {
		return '<div id="drag_icon_' + index + '" class="popup-drag-icon">' +
			   '  <span class="drag-icon-holder"></span><div class="drag-icon-overlay"></div>' +
			   '</div>';
	},
	//endregion
}, {
	setParameterValue: function(id, value) {
		$("#" + id.replace("parameter_button_", "val_")).val(value);
		cdfdd.impromptu.hide();
	}
});

var IndicatorMappingArrayRenderer = ValuesArrayRenderer.extend({
	
	//used for value input labels
	argTitle: 'Indicator name',
	valTitle: 'Datasource',
	popupTitle: 'Indicator Mapping',

	valPlaceHolderText: 'Datasource...',

	getData: function() {
		var data = {};

		var filters = _.sortBy(Panel.getPanel(DatasourcesPanel.MAIN_PANEL).getDatasources(), function (filter) {
			return filter.properties[0].value;
		});

		if (filters.length > 0) {
			$.each(filters, function(i, filter) {
				var value = filter.properties[0].value;
				data[value] = value;
			});
		} else {
			data[''] = '';
		}

		return data;
	},
});
