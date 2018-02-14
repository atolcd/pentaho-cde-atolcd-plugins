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

(function() {
	requireCfg.map = requireCfg.map || {};
	requireCfg.map['*'] = requireCfg.map['*'] || {};

	var isDebug = typeof document == "undefined" || document.location.href.indexOf("debug=true") > 0;
	
	if (typeof KARMA_RUN !== "undefined") { // unit tests
		requireCfg.paths['atolcd-cde-plugin/components'] = 'resources/components';
	} else if(typeof CONTEXT_PATH !== "undefined") { // production
		requireCfg.paths['atolcd-cde-plugin/components'] = CONTEXT_PATH + 'api/repos/atolcd-cde-plugin/resources/components';
	} else if(typeof FULL_QUALIFIED_URL != "undefined") { // embedded
		requireCfg.paths['atolcd-cde-plugin/components'] = FULL_QUALIFIED_URL + 'api/repos/atolcd-cde-plugin/resources/components';
	} else { // build
		requireCfg.paths['atolcd-cde-plugin/components'] = '../resources/components';
	}

	requireCfg.map['*']['atolcd-cde-plugin/components/SVGComponent'] = 'atolcd-cde-plugin/components/SVG/SVGComponent';
})();

(function() {
	requireCfg.config = requireCfg.config || {};

	var prefix;
	
	if (typeof KARMA_RUN !== "undefined") { // unit tests
		// TODO: is this necessary?
	} else if (typeof CONTEXT_PATH !== "undefined") { // production
		prefix = CONTEXT_PATH;
	} else if (typeof FULL_QUALIFIED_URL !== "undefined") { // embedded
		prefix = FULL_QUALIFIED_URL;
	} else { // build
		// TODO: is this necessary?
	}
})();
