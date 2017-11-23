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

define([
	'cdf/components/UnmanagedComponent',
	'cdf/lib/jquery',
	'amd!cdf/lib/underscore',
	'./geostats.min',
	'./simple-statistics.min',
	'./saveSvgAsPng',
	'./svg-pan-zoom.min',
	'css!./SVGComponent'
], function(UnmanagedComponent, $, _, geostats, ss, svgPng) {
	SVGComponent = UnmanagedComponent.extend({
		statMethods: ['User defined classification', 'Unique values', 'Equal intervals', 'Quantiles', 'Standard deviation', 'Jenks natural breaks', 'K-means', 'Arithmetic progression', 'Geometric progression'],
		colorThemes: {
			'Manual': '',
			'Yellow - Red': ['#FFFFCC', '#FFE6B4', '#FFC696', '#FFA176', '#FF7755', '#E05544', '#CC3333', '#990000', '#660000'],
			'Green': ['#F7FCF5', '#E5F5E0', '#C7E9C0', '#A1D99B', '#74C476', '#41AB5D', '#238B45', '#006D2C', '#00441B'],
			'Yellow - Purple': ['#FFF6DD', '#F5E5D5', '#E9CFCA', '#DBB8BF', '#CB9FB2', '#BB84A6', '#AA6998', '#984D8A', '#852E7C'],
			'Grey': ['#F1F1F1', '#E1E1E1', '#CECECE', '#B8B8B8', '#A1A1A1', '#8A8A8A', '#727272', '#5B5B5B', '#444444'],
			'Blue - White - Red': ['#0000FF', '#5F5FFF', '#8F8FFF', '#BFBFFF', '#FFFFFF', '#FFBFBF', '#FF8F8F', '#FF5F5F', '#FF0000']
		},
		
		update: function(datasource) {
			var render = _.bind(this.render, this);
			
			if (typeof datasource !== 'undefined') {
				this.queryDefinition.dataSource = datasource;
			}
			
			if (typeof this.queryDefinition.dataSource !== 'undefined') {
				this.triggerQuery(this.queryDefinition, render);
			} else {
				this.synchronous(render);
			}
		},
		
		render: function(data) {
			var comp = this;
			var ph = this.placeholder();
			var svgDatasource = this.svgDatasource;
			
			ph.empty();
			
			if (typeof this.title !== 'undefined') {
				var titleFormat = this.titleFormat;
				var titleContainer;
				
				if (typeof titleFormat === 'function') {
					titleContainer = titleFormat(this.title);
				} else {
					titleContainer = '<h2 class="svg-component-title">' + this.title + '</h2>';
				}
				
				ph.append(titleContainer);
			}
			
			if (typeof svgDatasource !== 'undefined') {
				var query = this.dashboard.getQuery({dataSource: svgDatasource});
				
				query.setOption('params', this.svgDatasourceParameters);
				
				$.ajax({
					method: 'POST',
					async: true,
					dataType: 'json',
					url: query.getOption('url'),
					data: query.buildQueryDefinition(),
					success: function(dt) {
						var dtResultset = dt.resultset;
						if (dtResultset.length > 0) {
							comp.svgContent = dtResultset[0][0];
							comp.renderComponentElements(data);
						} else {
							comp.renderWithSvgFile(data);
						}
					},
					error: comp.failExec
				});
			} else {
				this.renderWithSvgFile(data);
			}
		},
		
		/** Render with SVG file if SVG datasource is not available */
		renderWithSvgFile: function(data) {
			var comp = this;
			var svgFile = this.svgFile;
			
			if (typeof svgFile !== 'undefined') {
				var svgFilePath = '/pentaho/plugin/pentaho-cdf-dd/api/resources' + svgFile;
				
				$.ajax({
					method: 'GET',
					async: true,
					dataType: 'text',
					url: svgFilePath,
					success: function(response) {
						comp.svgContent = response;
						comp.renderComponentElements(data);
					},
					error: comp.failExec
				});
			}
		},
		
		/** Render essential elements of the component */
		renderComponentElements: function(data) {
			if (typeof this.svgContent === 'undefined') {
				return;
			}
			
			var ph = this.placeholder();
			
			ph.append(this.svgContent);
			
			var ratio = this.ratio;
			
			if (ratio < 0) {
				ratio = 0;
			}
			
			if ((typeof ratio !== 'undefined') && (ratio !== 100)) {
				var svgContainer = $(ph).find('svg').first();
				var svgWidth = parseFloat(svgContainer.attr('width')) * ratio / 100;
				var svgHeight = parseFloat(svgContainer.attr('height')) * ratio / 100;
				
				$(ph).find('svg').attr('width', svgWidth).attr('height', svgHeight);
			}
			
			if (this.legend.length > 0) {
				this.handleAutoLabels();
				
				if (typeof data.resultset !== 'undefined') {
					this.colorizeSvg(data);
				}
				
				var legendFormat = this.legendFormat;
				
				if (typeof legendFormat === 'function') {
					var legendContainer = legendFormat(this.legend);
					ph.append(legendContainer);
				} else {
					ph.append('<div id="svgComponentLegendContainer" />');
					this.genLegend();
					
					if (this.legendClickMode != 'none') {
						this.handleLegendItemClick();
					}
				}
				
				if (this.dynamicSelectorsEnabled) {
					this.genDynamicSelectors();
				}
			}
			
			if (this.zoomEnabled) {
				require(['svg-pan-zoom'], function(svgPanZoom) {
					svgPanZoom($(ph).find('svg')[0], {
						zoomEnabled: true,
						controlIconsEnabled: true,
						fit: true,
						center: true,
						minZoom: 0.1
					});
				});
			}
			
			if (this.exportButtonEnabled) {
				$(ph).append('<button id="exportButtonPNG">Export as PNG</button>');
				$('#exportButtonPNG').click(this.exportPng.bind(this));
			}
			
			if (this.tooltipEnabled || typeof this.tooltipEnabled === 'undefined') {
				this.handleHover(data);
			}
			
			this.handleClick(data);
		},
		
		/** Handle automatic labels for the manual statistical methods */
		handleAutoLabels: function() {
			var valueType = this.legend[0];
			var statMethod = this.legend[1];
			var autoLabels = this.legend[3];
			var leg = this.legend.slice(5);
			
			if (autoLabels && (valueType == 'Numeric')) {
				if (statMethod == 'User defined classification') {
					$.each(leg, function(i, item) {
						if ($.isNumeric(item[1]) && $.isNumeric(item[2])) {
							item[0] = item[1] + ' - ' + item[2];
						} else if (!$.isNumeric(item[1]) && $.isNumeric(item[2])) {
							item[0] = '<= ' + item[2];
						} else if ($.isNumeric(item[1]) && !$.isNumeric(item[2])) {
							item[0] = '> ' + item[1];
						} else {
							item[0] = 'All';
						}
					});
				} else if (statMethod == 'Unique values') {
					$.each(leg, function(i, item) {
						item[0] = item[1] + '';
					});
				}
			}
		},
		
		/** Colorize the SVG according to the legend */
		colorizeSvg: function(data) {
			var comp = this;
			var valueType = this.legend[0];
			var statMethod = this.legend[1];
			var autoLabels = this.legend[3];
			var leg = this.legend.slice(5);
			
			if (data.metadata.length > 1) {
				if (valueType == 'Numeric') {
					if (statMethod == 'User defined classification') {
						$.each(data.resultset, function(i, line) {
							var entVal = line[1];
							
							if (typeof entVal !== 'undefined' && entVal !== null) {
								var entId = line[0].toString().trim();
								var color = '';
								
								$.each(leg, function(i, item) {
									if ($.isNumeric(item[1]) && $.isNumeric(item[2])) {
										if (parseFloat(entVal) > parseFloat(item[1]) && parseFloat(entVal) <= parseFloat(item[2])) {
											color = item[3];
											return false;
										}
									} else if (!$.isNumeric(item[1]) && $.isNumeric(item[2])) {
										if (parseFloat(entVal) <= parseFloat(item[2])) {
											color = item[3];
											return false;
										}
									} else if ($.isNumeric(item[1]) && !$.isNumeric(item[2])) {
										if (parseFloat(entVal) > parseFloat(item[1])) {
											color = item[3];
											return false;
										}
									} else {
										color = item[3];
									}
								});
								
								comp.colorizeEntity(entId, color);
							}
						});
					} else if (statMethod == 'Unique values') {
						$.each(data.resultset, function(i, line) {
							var entVal = line[1];
							
							if (typeof entVal !== 'undefined' && entVal !== null) {
								var entId = line[0].toString().trim();
								var color = '';
								
								$.each(leg, function(i, item) {
									if (parseFloat(entVal) === parseFloat(item[1])) {
										color = item[3];
										return false;
									}
								});
								
								comp.colorizeEntity(entId, color);
							}
						});
					} else {
						var vals = [];
						
						$.each(data.resultset, function(i, line) {
							if ($.isNumeric(line[1])) {
								vals.push(line[1]);
							}
						});
						
						if (vals.length > 0) {
							if (statMethod == 'K-means') {
								var clusters = ss.ckmeans(vals, leg.length);
								
								$.each(clusters, function(i, cluster) {
									var min = ss.min(cluster);
									var max = ss.max(cluster);
									clusters[i] = [min, max];
									
									if (autoLabels) {
										leg[i][0] = (min == max) ? (min + '') : (min + ' - ' + max);
									}
								});
								
								$.each(data.resultset, function(i, line) {
									var entVal = line[1];
									
									if (typeof entVal !== 'undefined' && entVal !== null) {
										var entId = line[0].toString().trim();
										var color = '';
										
										$.each(clusters, function(i, cluster) {
											if ($.isNumeric(cluster[0]) && $.isNumeric(cluster[1])) {
												if (parseFloat(entVal) >= parseFloat(cluster[0]) && parseFloat(entVal) <= parseFloat(cluster[1])) {
													color = leg[i][3];
													return false;
												}
											}
										});
										
										comp.colorizeEntity(entId, color);
									}
								});
							} else {
								var gs = new geostats(vals);
								var nbClasses = leg.length;
								var intvs = [];
								
								switch (statMethod) {
									case 'Equal intervals':
										gs.getClassEqInterval(nbClasses);
										break;
									case 'Quantiles':
										gs.getClassQuantile(nbClasses);
										break;
									case 'Standard deviation':
										gs.getClassStdDeviation(nbClasses);
										break;
									case 'Jenks natural breaks':
										gs.getClassJenks(nbClasses);
										break;
									case 'Arithmetic progression':
										gs.getClassArithmeticProgression(nbClasses);
										break;
									case 'Geometric progression':
										gs.getClassGeometricProgression(nbClasses);
										break;
								}
								
								if (autoLabels) {
									gs.setRanges();
									
									$.each(leg, function(i, item) {
										var limits = gs.ranges[i].split(' - ');
										var min = limits[0];
										var max = limits[1];
										item[0] = (min == max) ? (min + '') : (min + ' - ' + max);
									});
								}
								
								$.each(data.resultset, function(i, line) {
									var entVal = line[1];
									
									if (typeof entVal !== 'undefined' && entVal !== null) {
										var entId = line[0].toString().trim();
										var classIndex = gs.getClass(entVal);
										var color = $.isNumeric(classIndex) ? leg[classIndex][3] : '';
										
										comp.colorizeEntity(entId, color);
									}
								});
							}
						}
					}
				} else {
					$.each(data.resultset, function(i, line) {
						var entVal = line[1];
						
						if (typeof entVal !== 'undefined' && entVal !== null) {
							var entId = line[0].toString().trim();
							var color = '';
							
							$.each(leg, function(i, item) {
								if (entVal.trim() == item[0].trim()) {
									color = item[3];
									return false;
								}
							});
							
							comp.colorizeEntity(entId, color);
						}
					});
				}
			}
		},
		
		/** Colorize an entity in the SVG */
		colorizeEntity: function(entId, color) {
			var ph = this.placeholder();
			var entity = $(ph).find('svg').find('[id="' + entId + '"]');
			
			entity.css('fill', color);
		},
		
		/** Generate the legend */
		genLegend: function() {
			var comp = this;
			var ph = this.placeholder();
			var valueType = this.legend[0];
			var statMethod = this.legend[1];
			var autoLabels = this.legend[3];
			var leg = this.legend.slice(5);
			var intl = this.checkIntl();
			
			if (autoLabels && valueType == 'Numeric') {
				if (statMethod == 'User defined classification') {
					$.each(leg, function(i, item) {
						var limits = item[0].split(' - ');
						
						if (limits.length > 1) {
							item[0] = comp.formatKSeparatorNumber(limits[0], intl) + ' - ' + comp.formatKSeparatorNumber(limits[1], intl);
						} else {
							if (item[0].includes('<=')) {
								item[0] = '&#8804; ' + comp.formatKSeparatorNumber(item[0].split('<= ')[1], intl);
							} else if (item[0].includes('>')) {
								item[0] = '> ' + comp.formatKSeparatorNumber(item[0].split('> ')[1], intl);
							}
						}
					});
				} else if (statMethod == 'Unique values') {
					$.each(leg, function(i, item) {
						item[0] = comp.formatKSeparatorNumber(item[0], intl);
					});
				} else {
					$.each(leg, function(i, item) {
						var limits = item[0].split(' - ');
						
						if (limits.length > 1) {
							item[0] = comp.formatStandardNumber(limits[0], intl) + ' - ' + comp.formatStandardNumber(limits[1], intl);
						} else {
							if ($.isNumeric(limits[0])) {
								item[0] = comp.formatStandardNumber(limits[0], intl);
							}
						}
					});
				}
			}
			
			var legLength = leg.length;
			var maxWidthLine = 0;
			var maxLength = 0;
			
			$.each(leg, function(i, item) {
				if (item[0].length > maxLength) {
					maxLength = item[0].length;
					maxWidthLine = i;
				}
			});
			
			var tmp = $('<span style="display: inline-block;"><span class="svg-component-legend-item" /><label class="svg-component-legend-item-label">' + leg[maxWidthLine][0].trim() + '</label></span>');
			
			$(ph).append(tmp);
			
			var maxLegLineWidth = tmp[0].scrollWidth;
			
			tmp.remove();
			
			var legWidth = parseFloat($(ph).find('#svgComponentLegendContainer').css('width'));
			var nbCols = parseInt((legWidth + 40) / (maxLegLineWidth + 40));
			
			if (nbCols > legLength) {
				nbCols = legLength;
			}
			
			var nbLinesPerCol = Math.ceil(legLength / nbCols);
			var legendContent = '';
			
			$.each(leg, function(i, item) {
				var line = '<div class="svg-component-legend-line">';
				line += '<span class="svg-component-legend-item" style="background-color: ' + item[3] + ';" />';
				line += '<label class="svg-component-legend-item-label">' + item[0].trim() + '</label>';
				line += '</div>';
				
				legendContent += (i % nbLinesPerCol === 0) ? '<div class="svg-component-legend-column">' : '';
				legendContent += line;
				legendContent += (i % nbLinesPerCol === (nbLinesPerCol - 1)) || (i === legLength - 1) ? '</div>' : '';
			});
			
			$(ph).find('#svgComponentLegendContainer').append(legendContent);
		},
		
		/** Verify the Intl object for further number formatting */
		checkIntl: function() {
			return !!(typeof Intl == 'object' && Intl && typeof Intl.NumberFormat == 'function');
		},
		
		/** Standard number format for legend item limits (automatic statistical methods) */
		formatStandardNumber: function(limit, intl) {
			var formatted;
			
			limit = parseFloat(limit);
			
			if (limit >= 1000) {
				var limitInt = limit.toFixed(0);
				formatted = intl ? parseInt(limitInt).toLocaleString() : limitInt.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
			} else {
				var limitDec = parseFloat(limit.toFixed(2));
				formatted = intl ? limitDec.toLocaleString() : limitDec.toString();
			}
			
			return formatted;
		},
		
		/** Thousand separator only number format for legend item limits (manual statistical methods) and numeric values in the tooltip */
		formatKSeparatorNumber: function(limit, intl) {
			limit = parseFloat(limit);
			return intl ? limit.toLocaleString(undefined, {maximumFractionDigits: 20}) : (limit >= 1000 ? limit.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') : limit.toString());
		},
		
		/** Handle click on legend items */
		handleLegendItemClick: function() {
			var comp = this;
			var ph = this.placeholder();
			var mode = this.legendClickMode;
			var legendItems = $(ph).find('#svgComponentLegendContainer .svg-component-legend-item');
			
			legendItems.hover(function() {
				$(this).css('cursor', 'pointer');
			});
			
			legendItems.click(function() {
				var it = $(this);
				var color = it.css('background-color');
				var colorClass = comp.getColorClass(color);
				var svgElems = $(ph).find('svg').find('[id]');
				
				if (mode == 'toggleSelected') {
					if (it.hasClass('selected')) {
						legendItems.removeClass('unchecked');
						it.removeClass('selected');
						
						svgElems.each(function() {
							var el = $(this);
							var elemClasses = el.attr('class');
							
							if (typeof elemClasses !== 'undefined') {
								if (elemClasses.includes('decolorized-')) {
									var colorString = elemClasses.split('decolorized-')[1].split(' ')[0];
									var cClass = 'decolorized-' + colorString;
									
									if (colorString.includes('-')) {
										colorString = 'rgb(' + colorString.replace(/-/g, ', ') + ')';
									} else if ($.isNumeric(colorString)) {
										colorString = '#' + colorString;
									}
									
									comp.svgRemoveClass(el, cClass);
									el.css({fill: colorString, transition: "0.2s"});
								}
							}
						});
					} else {
						if (it.hasClass('unchecked')) {
							var itemToUncheck = legendItems.filter(function() {
								return $(this).hasClass('selected');
							}).first();
							var colorToSwitch = $(itemToUncheck).css('background-color');
							var colorClassToSwitch = comp.getColorClass(colorToSwitch);
							
							$(itemToUncheck).removeClass('selected').addClass('unchecked');
							it.removeClass('unchecked').addClass('selected');
							
							var entitiesToSwitch = svgElems.filter(function() {
								return $(this).css('fill') == colorToSwitch;
							});
							
							if (typeof entitiesToSwitch !== 'undefined') {
								comp.svgAddClass(entitiesToSwitch, colorClassToSwitch);
								entitiesToSwitch.css({fill: "", transition: "0.2s"});
							}
							
							var entities = $(ph).find('svg').find('.' + colorClass);
							
							if (typeof entities !== 'undefined') {
								comp.svgRemoveClass(entities, colorClass);
								entities.css({fill: color, transition: "0.2s"});
							}
						} else {
							legendItems.addClass('unchecked');
							it.removeClass('unchecked').addClass('selected');
							
							var colors = [];
							var colorsClasses = [];
							
							legendItems.each(function() {
								var c = $(this).css('background-color');
								
								if (c != color) {
									colors.push(c);
									colorsClasses.push(comp.getColorClass(c));
								}
							});
							
							svgElems.each(function() {
								var el = $(this);
								var colorIndex = colors.indexOf(el.css('fill'));
								
								if (colorIndex >= 0) {
									var cClass = colorsClasses[colorIndex];
									
									comp.svgAddClass(el, cClass);
									el.css({fill: "", transition: "0.2s"});
								}
							});
						}
					}
				} else {
					if (it.hasClass('unchecked')) {
						it.removeClass('unchecked');
						
						var entities = $(ph).find('svg').find('.' + colorClass);
						
						if (typeof entities !== 'undefined') {
							comp.svgRemoveClass(entities, colorClass);
							entities.css({fill: color, transition: "0.2s"});
						}
					} else {
						it.addClass('unchecked');
						
						var entities = svgElems.filter(function() {
							return $(this).css('fill') == color;
						});
						
						if (typeof entities !== 'undefined') {
							comp.svgAddClass(entities, colorClass);
							entities.css({fill: "", transition: "0.2s"});
						}
					}
				}
			});
		},
		
		/** Get CSS class corresponding to a color in RGB or hex or HTML color name */
		getColorClass: function(color) {
			var colorClass = 'decolorized-';
			
			if (color.includes('rgb')) {
				colorClass += color.split('(')[1].split(')')[0].replace(/, /g, '-').trim();
			} else {
				colorClass += color.replace('#', '').trim();
			}
			
			return colorClass;
		},
		
		/** Add a class to each selected element of the SVG (cannot be directly added) */
		svgAddClass: function(elements, classToAdd) {
			$(elements).each(function(i, elem) {
				var tmp = $("<div class='" + $(elem).attr('class') + "'/>");
				
				tmp.addClass(classToAdd);
				$(elem).attr('class', tmp.attr('class'));
			});
		},
		
		/** Remove a class from each selected element of the SVG (cannot be directly removed) */
		svgRemoveClass: function(elements, classToRemove) {
			$(elements).each(function(i, elem) {
				var tmp = $("<div class='" + $(elem).attr('class') + "'/>");
				
				tmp.removeClass(classToRemove);
				$(elem).attr('class', tmp.attr('class'));
			});
		},
		
		/** Generate the dynamic selectors */
		genDynamicSelectors: function() {
			var ph = this.placeholder();
			var legend = this.legend;
			
			ph.append('<div id="svgComponentDynamicSelectorsContainer" />');
			
			if (this.indicatorMapping.length > 0) {
				this.genIndicatorSelector();
			}
			
			if (legend[0] != 'Nominal') {
				this.genStatMethodSelector();
			}
			
			if (legend[2] != 'Manual') {
				this.genNbClassesSelector();
			}
			
			this.genColorThemeSelector();
			
			if (legend[2] != 'Manual') {
				this.genInverseCheckbox();
			}
		},
		
		/** Generate the indicator selector */
		genIndicatorSelector: function() {
			var comp = this;
			var ph = this.placeholder();
			var selectedDatasource = this.queryDefinition.dataSource;
			var indicatorOptions = '<option disabled="">-</option>\n';
			
			$.each(this.indicatorMapping, function(i, indicator) {
				indicatorOptions += '<option value="' + indicator[1] + '">' + indicator[0] + '</option>\n';
			});

			var indicatorSelector = '<div class="svg-component-dynamic-selector">' +
				'  <div>Indicator</div>' +
				'  <div>\n' +
				'    <select id="indicatorOnSVG">' + indicatorOptions + '</select>' +
				'  </div>\n' +
				'</div>';
			
			$(ph).find('#svgComponentDynamicSelectorsContainer').append(indicatorSelector);
			
			if (typeof selectedDatasource === 'undefined') {
				selectedDatasource = '-';
			}
			
			$(ph).find('#indicatorOnSVG option').filter(function() {
				return ($(this).val() == selectedDatasource);
			}).prop('selected', true);
			
			$(ph).find('#indicatorOnSVG').change(function() {
				comp.update($(this).val());
			});
		},
		
		/** Generate the statistical method selector */
		genStatMethodSelector: function() {
			var comp = this;
			var ph = this.placeholder();
			var selectedMethod = this.legend[1];
			var statMethodOptions = '';
			
			$.each(this.statMethods, function(i, method) {
				statMethodOptions += '<option>' + method + '</option>\n';
			});

			var statMethodSelector = '<div class="svg-component-dynamic-selector">' +
				'  <div>Statistical method</div>' +
				'  <div>\n' +
				'    <select id="statMethodOnSVG">' + statMethodOptions + '</select>' +
				'  </div>\n' +
				'</div>';
			
			$(ph).find('#svgComponentDynamicSelectorsContainer').append(statMethodSelector);
			
			$(ph).find('#statMethodOnSVG option').filter(function() {
				return ($(this).text() == selectedMethod);
			}).prop('selected', true);
			
			$(ph).find('#statMethodOnSVG option').filter(function() {
				return ($(this).text() == 'User defined classification' || $(this).text() == 'Unique values');
			}).prop('disabled', true);
			
			$(ph).find('#statMethodOnSVG').change(function() {
				comp.legend[1] = $(this).val();
				comp.update();
			});
		},
		
		/** Generate the selector for the number of classes */
		genNbClassesSelector: function() {
			var comp = this;
			var ph = this.placeholder();
			var nb_classes = this.legend.length - 5;
			var selectedTheme = this.legend[2];
			var themeColors = this.colorThemes[selectedTheme];
			var classesOptions = '<option>1 class</option>\n';
			
			for (var i = 1; i < themeColors.length; i++) {
				classesOptions += '<option>' + (i + 1) + ' classes</option>\n';
			}
			
			var nbClassesSelector = '<div class="svg-component-dynamic-selector">' +
				'  <div>Classes</div>' +
				'  <div>\n' +
				'    <select id="nbClassesOnSVG">' + classesOptions + '</select>' +
				'  </div>\n' +
				'</div>';
				
			$(ph).find('#svgComponentDynamicSelectorsContainer').append(nbClassesSelector);
			
			$(ph).find('#nbClassesOnSVG option').filter(function() {
				return (parseInt($(this).text().split(' ')[0]) == nb_classes);
			}).prop('selected', true);
			
			if (this.legend[1] == 'User defined classification' || this.legend[1] == 'Unique values' || this.legend[2] == 'Manual') {
				$(ph).find('#nbClassesOnSVG option').filter(function() {
					return (parseInt($(this).text().split(' ')[0]) > nb_classes);
				}).prop('disabled', true);
			}
			
			$(ph).find('#nbClassesOnSVG').change(function() {
				var nb = parseInt($(this).val().split(' ')[0]);
				var inverse = comp.legend[4];
				var colors = comp.pickColors(themeColors, nb, inverse);
				
				if (nb < nb_classes) {
					for (var i = 0; i < nb_classes - nb; i++) {
						comp.legend.pop();
					}
				} else {
					for (var i = 0; i < nb - nb_classes; i++) {
						comp.legend.push(['', '', '', '']);
					}
				}
				
				$.each(colors, function(i, color) {
					comp.legend[i + 5][3] = color;
				});
				
				comp.update();
			});
		},
		
		/** Generate the color theme selector */
		genColorThemeSelector: function() {
			var comp = this;
			var ph = this.placeholder();
			var selectedTheme = this.legend[2];
			var colorThemeOptions = '';
			
			for (var th in this.colorThemes) {
				colorThemeOptions += '<option>' + th + '</option>\n';
			}

			var colorThemeSelector = '<div class="svg-component-dynamic-selector">' +
				'  <div>Color theme</div>' +
				'  <div>\n' +
				'    <select id="colorThemeOnSVG">' + colorThemeOptions + '</select>' +
				'  </div>\n' +
				'</div>';
				
			$(ph).find('#svgComponentDynamicSelectorsContainer').append(colorThemeSelector);
			
			$(ph).find('#colorThemeOnSVG option').filter(function() {
				return ($(this).text() == selectedTheme);
			}).prop('selected', true);
			
			$(ph).find('#colorThemeOnSVG option').filter(function() {
				return ($(this).text() == 'Manual');
			}).prop('disabled', true);
			
			$(ph).find('#colorThemeOnSVG').change(function() {
				var theme = $(this).val();
				var themeColors = comp.colorThemes[theme];
				var nb_classes = comp.legend.length - 5;
				var inverse = comp.legend[4];
				var colors = comp.pickColors(themeColors, nb_classes, inverse);
				comp.legend[2] = $(this).val();
				
				$.each(colors, function(i, color) {
					comp.legend[i + 5][3] = color;
				});
				
				comp.update();
			});
		},
		
		/** Generate the color theme inversion checkbox */
		genInverseCheckbox: function() {
			var comp = this;
			var ph = this.placeholder();
			var inverse = this.legend[4];
			var inverseCheckbox = '<div class="svg-component-dynamic-selector">' +
				'  <input id="inverseColorThemeOnSVG" type="checkbox">' +
				'  <label class="vertical-middle">Inverse</label>' +
				'</div>';
				
			$(ph).find('#svgComponentDynamicSelectorsContainer').append(inverseCheckbox);
			$(ph).find('#inverseColorThemeOnSVG').prop('checked', inverse);
			
			$(ph).find('#inverseColorThemeOnSVG').change(function() {
				var leg = comp.legend.slice(5);
				var colors = [];
				
				comp.legend[4] = $(this).prop('checked');
				
				$.each(leg, function(i, item) {
					colors[leg.length - 1 - i] = item[3];
				});
				
				$.each(colors, function(i, color) {
					comp.legend[i + 5][3] = color;
				});
				
				comp.update();
			});
		},
		
		/** Create a color array from a given color theme, with a given number of classes and the inversion property */
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
		
		/** Create a balanced array of integers from 0 to n */
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
		
		/** Average value of 2 numbers */
		average: function(a, b) {
			var medium = Math.floor((a + b) / 2);
			return medium == a ? '' : medium;
		},
		
		/** Transfer an item from one array to another */
		arrayTransfer: function(ar1, ar2, x) {
			ar2.push(x);
			ar1.splice(ar1.indexOf(x), 1);
		},
		
		/** Callback function for exporting the SVG in PNG format */
		exportPng: function() {
			var ph = this.placeholder();
			var fileName = this.name.split('render_')[1].trim() + '.png';
			
			svgPng.saveSvgAsPng($(ph).find('svg').first()[0], fileName);
		},
		
		/** Handle hover on the SVG entities */
		handleHover: function(dt) {
			var comp = this;
			var ph = this.placeholder();
			var tooltipFormat = this.tooltipFormat;
			
			$(ph).find('svg').find('[id]').hover(function(event) {
				var entSvgId = $(this).attr('id');
				var data; // data related to the hovered entity
				var svgTooltipContainer;
				
				if ((typeof dt.resultset !== 'undefined') && (typeof entSvgId !== 'undefined')) {
					$.each(dt.resultset, function(i, line) {
						if (typeof line[0] !== 'undefined' && line[0] !== null) {
							var entId = line[0].toString().trim();
							
							if (entId == entSvgId.trim()) {
								data = line;
								return false;
							}
						}
					});
				}
				
				if (typeof tooltipFormat === 'function') {
					svgTooltipContainer = (typeof data !== 'undefined') ? tooltipFormat.call(this, data) : tooltipFormat.call(this);
				} else {
					svgTooltipContainer = comp.genSvgTooltip(data, dt.metadata);
				}
				
				var left = event.pageX;
				var top = event.pageY;
				
				svgTooltipContainer = '<div class="svg-component-tooltip-outer-container" style="top: ' + Math.ceil(top) + 'px; left: ' + Math.ceil(left) + 'px;">' + svgTooltipContainer + '</div>';
				$('body').append(svgTooltipContainer);
			}, function() {
				$('.svg-component-tooltip-outer-container').hide();
				$('.svg-component-tooltip-outer-container').remove();
			});
		},
		
		/** Generate the tooltip */
		genSvgTooltip: function(data, metadata) {
			var comp = this;
			var intl = this.checkIntl();
			
			if (typeof data !== 'undefined') {
				var svgTooltipContainer = '<div class="svg-component-tooltip-container">';
				
				$.each(data, function(i, colValue) {
					var colTitle = metadata[i].colName;
					svgTooltipContainer += (typeof colValue !== 'undefined' && colValue !== null) ? ('<label class="svg-component-tooltip-item">' + colTitle + ' : ' + ((i !== 0 && $.isNumeric(colValue)) ? comp.formatKSeparatorNumber(colValue, intl) : colValue) + '</label>') : '';
				});
				
				if (this.paramsCheck()) {
					var dash = this.dashboard;
					
					$.each(this.paramsToDisplay, function(i, param) {
						var paramVal = dash.getParameterValue(param[1]);
						svgTooltipContainer += paramVal ? ('<label class="svg-component-tooltip-item">' + param[0] + ' : ' + ($.isNumeric(paramVal) ? comp.formatKSeparatorNumber(paramVal, intl) : paramVal) + '</label>') : '';
					});
				}
				
				svgTooltipContainer += '</div>';
				
				return svgTooltipContainer;
			}
			
			return '';
		},
		
		/** Verify that all parameters to be displayed in the tooltip are included in the parameters listened by this SVG component */
		paramsCheck: function() {
			var ph = this.placeholder();
			var params = this.listeners; // parameters listened by this SVG component
			var paramsDisplay = this.paramsToDisplay; // parameters to be displayed in the tooltip
			var paramsIncluded = paramsDisplay.every(function(value) {
				return (params.indexOf(value[1]) >= 0);
			});
			
			return (paramsDisplay.length > 0) && paramsIncluded;
		},
		
		/** Handle click on the SVG entities */
		handleClick: function(dt) {
			var comp = this;
			var ph = this.placeholder();
			var clickAction = this.clickAction;
			
			$(ph).find('svg').find('[id]').click(function() {
				var entSvgId = $(this).attr('id');
				var data; // data related to the clicked entity
				
				if (typeof entSvgId !== 'undefined') {
					if (typeof dt.resultset !== 'undefined') {
						$.each(dt.resultset, function(i, line) {
							if (typeof line[0] !== 'undefined') {
								var entId = line[0].toString().trim();
								
								if (entId == entSvgId.trim()) {
									data = line;
									return false;
								}
							}
						});
					}
					
					comp._value = entSvgId;
					comp.dashboard.processChange(comp.name);
				}
				
				if (typeof clickAction === 'function') {
					if (typeof data !== 'undefined') {
						clickAction.call(this, data);
					} else {
						clickAction.call(this);
					}
				}
			});
		},
		
		getValue: function() {
			return this._value;
		}
	});
	
	return SVGComponent;
});
