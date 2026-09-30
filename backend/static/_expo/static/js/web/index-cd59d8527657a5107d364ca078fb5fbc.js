__d(function(g,r,i,a,m,e,d){"use strict";Object.defineProperty(e,'__esModule',{value:!0});var t=r(d[0]);Object.keys(t).forEach(function(n){'default'===n||Object.prototype.hasOwnProperty.call(e,n)||Object.defineProperty(e,n,{enumerable:!0,get:function(){return t[n]}})})},1352,[1354]);
__d(function(g,r,i,a,m,_e,d){"use strict";Object.defineProperty(_e,'__esModule',{value:!0}),Object.defineProperty(_e,"getAnalytics",{enumerable:!0,get:function(){return ae}}),Object.defineProperty(_e,"getGoogleAnalyticsClientId",{enumerable:!0,get:function(){return se}}),Object.defineProperty(_e,"initializeAnalytics",{enumerable:!0,get:function(){return ie}}),Object.defineProperty(_e,"isSupported",{enumerable:!0,get:function(){return re}}),Object.defineProperty(_e,"logEvent",{enumerable:!0,get:function(){return pe}}),Object.defineProperty(_e,"setAnalyticsCollectionEnabled",{enumerable:!0,get:function(){return de}}),Object.defineProperty(_e,"setConsent",{enumerable:!0,get:function(){return fe}}),Object.defineProperty(_e,"setCurrentScreen",{enumerable:!0,get:function(){return oe}}),Object.defineProperty(_e,"setDefaultEventParameters",{enumerable:!0,get:function(){return ue}}),Object.defineProperty(_e,"setUserId",{enumerable:!0,get:function(){return ce}}),Object.defineProperty(_e,"setUserProperties",{enumerable:!0,get:function(){return le}}),Object.defineProperty(_e,"settings",{enumerable:!0,get:function(){return ee}});var e=r(d[0]),t=r(d[1]),n=r(d[2]),o=r(d[3]);r(d[4]);
/**
   * @license
   * Copyright 2019 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */
const s='analytics',c='https://www.googletagmanager.com/gtag/js',l=new t.Logger('@firebase/analytics'),u={"already-exists":"A Firebase Analytics instance with the appId {$id}  already exists. Only one Firebase Analytics instance can be created for each appId.","already-initialized":"initializeAnalytics() cannot be called again with different options than those it was initially called with. It can be called again with the same options to return the existing instance, or getAnalytics() can be used to get a reference to the already-initialized instance.","already-initialized-settings":"Firebase Analytics has already been initialized.settings() must be called before initializing any Analytics instanceor it will have no effect.","interop-component-reg-failed":'Firebase Analytics Interop Component failed to instantiate: {$reason}',"invalid-analytics-context":"Firebase Analytics is not supported in this environment. Wrap initialization of analytics in analytics.isSupported() to prevent initialization in unsupported environments. Details: {$errorInfo}","indexeddb-unavailable":"IndexedDB unavailable or restricted in this environment. Wrap initialization of analytics in analytics.isSupported() to prevent initialization in unsupported environments. Details: {$errorInfo}","fetch-throttle":"The config fetch request timed out while in an exponential backoff state. Unix timestamp in milliseconds when fetch request throttling ends: {$throttleEndTimeMillis}.","config-fetch-failed":'Dynamic config fetch failed: [{$httpStatus}] {$responseMessage}',"no-api-key":"The \"apiKey\" field is empty in the local Firebase config. Firebase Analytics requires this field tocontain a valid API key.","no-app-id":"The \"appId\" field is empty in the local Firebase config. Firebase Analytics requires this field tocontain a valid app ID.","no-client-id":'The "client_id" field is empty.',"invalid-gtag-resource":'Trusted Types detected an invalid gtag resource: {$gtagURL}.'},p=new n.ErrorFactory('analytics','Analytics',u);
/**
   * @license
   * Copyright 2019 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */
function f(e){if(!e.startsWith(c)){const t=p.create("invalid-gtag-resource",{gtagURL:e});return l.warn(t.message),''}return e}function h(e){return Promise.all(e.map(e=>e.catch(e=>e)))}function y(e,t){let n;return window.trustedTypes&&(n=window.trustedTypes.createPolicy(e,t)),n}function w(e,t){const n=y('firebase-js-sdk-policy',{createScriptURL:f}),o=document.createElement('script'),s=`${c}?l=${e}&id=${t}`;o.src=n?n?.createScriptURL(s):s,o.async=!0,document.head.appendChild(o)}function b(e){let t=[];return Array.isArray(window[e])?t=window[e]:window[e]=t,t}async function I(e,t,n,o,s,c){const u=o[s];try{if(u)await t[u];else{const e=(await h(n)).find(e=>e.measurementId===s);e&&await t[e.appId]}}catch(e){l.error(e)}e("config",s,c)}async function v(e,t,n,o,s){try{let c=[];if(s&&s.send_to){let e=s.send_to;Array.isArray(e)||(e=[e]);const o=await h(n);for(const n of e){const e=o.find(e=>e.measurementId===n),s=e&&t[e.appId];if(!s){c=[];break}c.push(s)}}0===c.length&&(c=Object.values(t)),await Promise.all(c),e("event",o,s||{})}catch(e){l.error(e)}}function P(e,t,n,o){return async function(s,...c){try{if("event"===s){const[o,s]=c;await v(e,t,n,o,s)}else if("config"===s){const[s,l]=c;await I(e,t,n,o,s,l)}else if("consent"===s){const[t,n]=c;e("consent",t,n)}else if("get"===s){const[t,n,o]=c;e("get",t,n,o)}else if("set"===s){const[t]=c;e("set",t)}else e(s,...c)}catch(e){l.error(e)}}}function M(e,t,n,o,s){let c=function(...e){window[o].push(arguments)};return window[s]&&'function'==typeof window[s]&&(c=window[s]),window[s]=P(c,e,t,n),{gtagCore:c,wrappedGtag:window[s]}}function T(e){const t=window.document.getElementsByTagName('script');for(const n of Object.values(t))if(n.src&&n.src.includes(c)&&n.src.includes(e))return n;return null}
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */const A=new class{constructor(e={},t=1e3){this.throttleMetadata=e,this.intervalMillis=t}getThrottleMetadata(e){return this.throttleMetadata[e]}setThrottleMetadata(e,t){this.throttleMetadata[e]=t}deleteThrottleMetadata(e){delete this.throttleMetadata[e]}};function D(e){return new Headers({Accept:'application/json','x-goog-api-key':e})}async function j(e){const{appId:t,apiKey:n}=e,o={method:'GET',headers:D(n)},s="https://firebase.googleapis.com/v1alpha/projects/-/apps/{app-id}/webConfig".replace('{app-id}',t),c=await fetch(s,o);if(200!==c.status&&304!==c.status){let e='';try{const t=await c.json();t.error?.message&&(e=t.error.message)}catch(e){}throw p.create("config-fetch-failed",{httpStatus:c.status,responseMessage:e})}return c.json()}async function F(e,t=A,n){const{appId:o,apiKey:s,measurementId:c}=e.options;if(!o)throw p.create("no-app-id");if(!s){if(c)return{measurementId:c,appId:o};throw p.create("no-api-key")}const l=t.getThrottleMetadata(o)||{backoffCount:0,throttleEndTimeMillis:Date.now()},u=new C;return setTimeout(async()=>{u.abort()},6e4),E({appId:o,apiKey:s,measurementId:c},l,u,t)}async function E(e,{throttleEndTimeMillis:t,backoffCount:o},s,c=A){const{appId:u,measurementId:p}=e;try{await $(s,t)}catch(e){if(p)return l.warn(`Timed out fetching this Firebase app's measurement ID from the server. Falling back to the measurement ID ${p} provided in the "measurementId" field in the local Firebase config. [${e?.message}]`),{appId:u,measurementId:p};throw e}try{const t=await j(e);return c.deleteThrottleMetadata(u),t}catch(t){const f=t;if(!x(f)){if(c.deleteThrottleMetadata(u),p)return l.warn(`Failed to fetch this Firebase app's measurement ID from the server. Falling back to the measurement ID ${p} provided in the "measurementId" field in the local Firebase config. [${f?.message}]`),{appId:u,measurementId:p};throw t}const h=503===Number(f?.customData?.httpStatus)?(0,n.calculateBackoffMillis)(o,c.intervalMillis,30):(0,n.calculateBackoffMillis)(o,c.intervalMillis),y={throttleEndTimeMillis:Date.now()+h,backoffCount:o+1};return c.setThrottleMetadata(u,y),l.debug(`Calling attemptFetch again in ${h} millis`),E(e,y,s,c)}}function $(e,t){return new Promise((n,o)=>{const s=Math.max(t-Date.now(),0),c=setTimeout(n,s);e.addEventListener(()=>{clearTimeout(c),o(p.create("fetch-throttle",{throttleEndTimeMillis:t}))})})}function x(e){if(!(e instanceof n.FirebaseError&&e.customData))return!1;const t=Number(e.customData.httpStatus);return 429===t||500===t||503===t||504===t}class C{constructor(){this.listeners=[]}addEventListener(e){this.listeners.push(e)}abort(){this.listeners.forEach(e=>e())}}
/**
   * @license
   * Copyright 2019 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */let O,_;async function k(e,t,n,o,s){if(s&&s.global)e("event",n,o);else{const s=await t;e("event",n,Object.assign({},o,{send_to:s}))}}async function z(e,t,n,o){if(o&&o.global)return e("set",{screen_name:n}),Promise.resolve();e("config",await t,{update:!0,screen_name:n})}async function B(e,t,n,o){if(o&&o.global)return e("set",{user_id:n}),Promise.resolve();e("config",await t,{update:!0,user_id:n})}async function L(e,t,n,o){if(o&&o.global){const t={};for(const e of Object.keys(n))t[`user_properties.${e}`]=n[e];return e("set",t),Promise.resolve()}e("config",await t,{update:!0,user_properties:n})}async function S(e,t){const n=await t;return new Promise((t,o)=>{e("get",n,'client_id',e=>{e||o(p.create("no-client-id")),t(e)})})}async function U(e,t){const n=await e;window[`ga-disable-${n}`]=!t}function N(e){_=e}function K(e){O=e}
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */async function q(){if(!(0,n.isIndexedDBAvailable)())return l.warn(p.create("indexeddb-unavailable",{errorInfo:'IndexedDB is not available in this environment.'}).message),!1;try{await(0,n.validateIndexedDBOpenable)()}catch(e){return l.warn(p.create("indexeddb-unavailable",{errorInfo:e?.toString()}).message),!1}return!0}async function R(e,t,n,o,s,c,u){const p=F(e);p.then(t=>{n[t.measurementId]=t.appId,e.options.measurementId&&t.measurementId!==e.options.measurementId&&l.warn(`The measurement ID in the local Firebase config (${e.options.measurementId}) does not match the measurement ID fetched from the server (${t.measurementId}). To ensure analytics events are always sent to the correct Analytics property, update the measurement ID field in the local config or remove it from the local config.`)}).catch(e=>l.error(e)),t.push(p);const f=q().then(e=>e?o.getId():void 0),[h,y]=await Promise.all([p,f]);T(c)||w(c,h.measurementId),_&&(s("consent",'default',_),N(void 0)),s('js',new Date);const b=u?.config??{};return b.origin='firebase',b.update=!0,null!=y&&(b.firebase_id=y),s("config",h.measurementId,b),O&&(s("set",O),K(void 0)),h.measurementId}
/**
   * @license
   * Copyright 2019 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */class G{constructor(e){this.app=e}_delete(){return delete V[this.app.options.appId],Promise.resolve()}}let V={},W=[];const H={};let J,Q,X='dataLayer',Y='gtag',Z=!1;function ee(e){if(Z)throw p.create("already-initialized");e.dataLayerName&&(X=e.dataLayerName),e.gtagName&&(Y=e.gtagName)}function te(){const e=[];if((0,n.isBrowserExtension)()&&e.push('This is a browser extension environment.'),(0,n.areCookiesEnabled)()||e.push('Cookies are not available.'),e.length>0){const t=e.map((e,t)=>`(${t+1}) ${e}`).join(' '),n=p.create("invalid-analytics-context",{errorInfo:t});l.warn(n.message)}}function ne(e,t,n){te();const o=e.options.appId;if(!o)throw p.create("no-app-id");if(!e.options.apiKey){if(!e.options.measurementId)throw p.create("no-api-key");l.warn(`The "apiKey" field is empty in the local Firebase config. This is needed to fetch the latest measurement ID for this Firebase app. Falling back to the measurement ID ${e.options.measurementId} provided in the "measurementId" field in the local Firebase config.`)}if(null!=V[o])throw p.create("already-exists",{id:o});if(!Z){b(X);const{wrappedGtag:e,gtagCore:t}=M(V,W,H,X,Y);Q=e,J=t,Z=!0}V[o]=R(e,W,H,t,J,X,n);return new G(e)}
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */function ae(t=(0,e.getApp)()){t=(0,n.getModularInstance)(t);const o=(0,e._getProvider)(t,s);return o.isInitialized()?o.getImmediate():ie(t)}function ie(t,o={}){const c=(0,e._getProvider)(t,s);if(c.isInitialized()){const e=c.getImmediate();if((0,n.deepEqual)(o,c.getOptions()))return e;throw p.create("already-initialized")}return c.initialize({options:o})}async function re(){if((0,n.isBrowserExtension)())return!1;if(!(0,n.areCookiesEnabled)())return!1;if(!(0,n.isIndexedDBAvailable)())return!1;try{return await(0,n.validateIndexedDBOpenable)()}catch(e){return!1}}function oe(e,t,o){e=(0,n.getModularInstance)(e),z(Q,V[e.app.options.appId],t,o).catch(e=>l.error(e))}async function se(e){return e=(0,n.getModularInstance)(e),S(Q,V[e.app.options.appId])}function ce(e,t,o){e=(0,n.getModularInstance)(e),B(Q,V[e.app.options.appId],t,o).catch(e=>l.error(e))}function le(e,t,o){e=(0,n.getModularInstance)(e),L(Q,V[e.app.options.appId],t,o).catch(e=>l.error(e))}function de(e,t){e=(0,n.getModularInstance)(e),U(V[e.app.options.appId],t).catch(e=>l.error(e))}function ue(e){Q?Q("set",e):K(e)}function pe(e,t,o,s){e=(0,n.getModularInstance)(e),k(Q,V[e.app.options.appId],t,o,s).catch(e=>l.error(e))}function fe(e){Q?Q("consent",'update',e):N(e)}const me="@firebase/analytics",he="0.10.23";(0,e._registerComponent)(new o.Component(s,(e,{options:t})=>ne(e.getProvider('app').getImmediate(),e.getProvider('installations-internal').getImmediate(),t),"PUBLIC")),(0,e._registerComponent)(new o.Component('analytics-internal',function(e){try{const t=e.getProvider(s).getImmediate();return{logEvent:(e,n,o)=>pe(t,e,n,o),setUserProperties:(e,n)=>le(t,e,n)}}catch(e){throw p.create("interop-component-reg-failed",{reason:e})}},"PRIVATE")),(0,e.registerVersion)(me,he),(0,e.registerVersion)(me,he,'esm2020')},1354,[794,798,796,795,1355]);
__d(function(g,r,i,a,m,_e,d){"use strict";Object.defineProperty(_e,'__esModule',{value:!0}),Object.defineProperty(_e,"deleteInstallations",{enumerable:!0,get:function(){return bt}}),Object.defineProperty(_e,"getId",{enumerable:!0,get:function(){return gt}}),Object.defineProperty(_e,"getInstallations",{enumerable:!0,get:function(){return Ct}}),Object.defineProperty(_e,"getToken",{enumerable:!0,get:function(){return wt}}),Object.defineProperty(_e,"onIdChange",{enumerable:!0,get:function(){return vt}});var t=r(d[0]),e=r(d[1]),n=r(d[2]),o=r(d[3]);const s="@firebase/installations",u="0.6.23",c=1e4,f=`w:${u}`,p='FIS_v2',l='https://firebaseinstallations.googleapis.com/v1',w=36e5,h={"missing-app-config-values":'Missing App configuration value: "{$valueName}"',"not-registered":'Firebase Installation is not registered.',"installation-not-found":'Firebase Installation not found.',"request-failed":'{$requestName} request failed with error "{$serverCode} {$serverStatus}: {$serverMessage}"',"app-offline":'Could not process request. Application offline.',"delete-pending-registration":"Can't delete installation while there is a pending registration request."},y=new n.ErrorFactory('installations','Installations',h);function b(t){return t instanceof n.FirebaseError&&t.code.includes("request-failed")}
/**
   * @license
   * Copyright 2019 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */function v({projectId:t}){return`${l}/projects/${t}/installations`}function C(t){return{token:t.token,requestStatus:2,expiresIn:(e=t.expiresIn,Number(e.replace('s','000'))),creationTime:Date.now()};var e}async function S(t,e){const n=(await e.json()).error;return y.create("request-failed",{requestName:t,serverCode:n.code,serverMessage:n.message,serverStatus:n.status})}function I({apiKey:t}){return new Headers({'Content-Type':'application/json',Accept:'application/json','x-goog-api-key':t})}function T(t,{refreshToken:e}){const n=I(t);return n.append('Authorization',P(e)),n}async function k(t){const e=await t();return e.status>=500&&e.status<600?t():e}function P(t){return`${p} ${t}`}
/**
   * @license
   * Copyright 2019 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */async function j({appConfig:t,heartbeatServiceProvider:e},{fid:n}){const o=v(t),s=I(t),u=e.getImmediate({optional:!0});if(u){const t=await u.getHeartbeatsHeader();t&&s.append('x-firebase-client',t)}const c={fid:n,authVersion:p,appId:t.appId,sdkVersion:f},l={method:'POST',headers:s,body:JSON.stringify(c)},w=await k(()=>fetch(o,l));if(w.ok){const t=await w.json();return{fid:t.fid||n,registrationStatus:2,refreshToken:t.refreshToken,authToken:C(t.authToken)}}throw await S('Create Installation',w)}
/**
   * @license
   * Copyright 2019 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */function q(t){return new Promise(e=>{setTimeout(e,t)})}
/**
   * @license
   * Copyright 2019 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */
/**
   * @license
   * Copyright 2019 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */
const $=/^[cdef][\w-]{21}$/,E='';function O(){try{const t=new Uint8Array(17);(self.crypto||self.msCrypto).getRandomValues(t),t[0]=112+t[0]%16;const e=D(t);return $.test(e)?e:E}catch{return E}}function D(t){var e;return(e=t,btoa(String.fromCharCode(...e)).replace(/\+/g,'-').replace(/\//g,'_')).substr(0,22)}
/**
   * @license
   * Copyright 2019 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */function _(t){return`${t.appName}!${t.appId}`}
/**
   * @license
   * Copyright 2019 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */const A=new Map;function N(t,e){const n=_(t);x(n,e),M(n,e)}function F(t,e){L();const n=_(t);let o=A.get(n);o||(o=new Set,A.set(n,o)),o.add(e)}function V(t,e){const n=_(t),o=A.get(n);o&&(o.delete(e),0===o.size&&A.delete(n),B())}function x(t,e){const n=A.get(t);if(n)for(const t of n)t(e)}function M(t,e){const n=L();n&&n.postMessage({key:t,fid:e}),B()}let H=null;function L(){return!H&&'BroadcastChannel'in self&&(H=new BroadcastChannel('[Firebase] FID Change'),H.onmessage=t=>{x(t.data.key,t.data.fid)}),H}function B(){0===A.size&&H&&(H.close(),H=null)}
/**
   * @license
   * Copyright 2019 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */const K='firebase-installations-database',z=1,J='firebase-installations-store';let R=null;function U(){return R||(R=(0,o.openDB)(K,z,{upgrade:(t,e)=>{if(0===e)t.createObjectStore(J)}})),R}async function G(t,e){const n=_(t),o=(await U()).transaction(J,'readwrite'),s=o.objectStore(J),u=await s.get(n);return await s.put(e,n),await o.done,u&&u.fid===e.fid||N(t,e.fid),e}async function Q(t){const e=_(t),n=(await U()).transaction(J,'readwrite');await n.objectStore(J).delete(e),await n.done}async function W(t,e){const n=_(t),o=(await U()).transaction(J,'readwrite'),s=o.objectStore(J),u=await s.get(n),c=e(u);return void 0===c?await s.delete(n):await s.put(c,n),await o.done,!c||u&&u.fid===c.fid||N(t,c.fid),c}
/**
   * @license
   * Copyright 2019 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */async function X(t){let e;const n=await W(t.appConfig,n=>{const o=Y(n),s=Z(t,o);return e=s.registrationPromise,s.installationEntry});return n.fid===E?{installationEntry:await e}:{installationEntry:n,registrationPromise:e}}function Y(t){return at(t||{fid:O(),registrationStatus:0})}function Z(t,e){if(0===e.registrationStatus){if(!navigator.onLine){return{installationEntry:e,registrationPromise:Promise.reject(y.create("app-offline"))}}const n={fid:e.fid,registrationStatus:1,registrationTime:Date.now()};return{installationEntry:n,registrationPromise:tt(t,n)}}return 1===e.registrationStatus?{installationEntry:e,registrationPromise:et(t)}:{installationEntry:e}}async function tt(t,e){try{const n=await j(t,e);return G(t.appConfig,n)}catch(n){throw b(n)&&409===n.customData.serverCode?await Q(t.appConfig):await G(t.appConfig,{fid:e.fid,registrationStatus:0}),n}}async function et(t){let e=await nt(t.appConfig);for(;1===e.registrationStatus;)await q(100),e=await nt(t.appConfig);if(0===e.registrationStatus){const{installationEntry:e,registrationPromise:n}=await X(t);return n||e}return e}function nt(t){return W(t,t=>{if(!t)throw y.create("installation-not-found");return at(t)})}function at(t){return 1===(e=t).registrationStatus&&e.registrationTime+c<Date.now()?{fid:t.fid,registrationStatus:0}:t;var e;
/**
   * @license
   * Copyright 2019 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */}async function it({appConfig:t,heartbeatServiceProvider:e},n){const o=rt(t,n),s=T(t,n),u=e.getImmediate({optional:!0});if(u){const t=await u.getHeartbeatsHeader();t&&s.append('x-firebase-client',t)}const c={installation:{sdkVersion:f,appId:t.appId}},p={method:'POST',headers:s,body:JSON.stringify(c)},l=await k(()=>fetch(o,p));if(l.ok){return C(await l.json())}throw await S('Generate Auth Token',l)}function rt(t,{fid:e}){return`${v(t)}/${e}/authTokens:generate`}
/**
   * @license
   * Copyright 2019 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */async function ot(t,e=!1){let n;const o=await W(t.appConfig,o=>{if(!ft(o))throw y.create("not-registered");const s=o.authToken;if(!e&&pt(s))return o;if(1===s.requestStatus)return n=st(t,e),o;{if(!navigator.onLine)throw y.create("app-offline");const e=dt(o);return n=ct(t,e),e}});return n?await n:o.authToken}async function st(t,e){let n=await ut(t.appConfig);for(;1===n.authToken.requestStatus;)await q(100),n=await ut(t.appConfig);const o=n.authToken;return 0===o.requestStatus?ot(t,e):o}function ut(t){return W(t,t=>{if(!ft(t))throw y.create("not-registered");const e=t.authToken;return 1===(n=e).requestStatus&&n.requestTime+c<Date.now()?Object.assign({},t,{authToken:{requestStatus:0}}):t;var n;
/**
   * @license
   * Copyright 2019 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */})}async function ct(t,e){try{const n=await it(t,e),o=Object.assign({},e,{authToken:n});return await G(t.appConfig,o),n}catch(n){if(!b(n)||401!==n.customData.serverCode&&404!==n.customData.serverCode){const n=Object.assign({},e,{authToken:{requestStatus:0}});await G(t.appConfig,n)}else await Q(t.appConfig);throw n}}function ft(t){return void 0!==t&&2===t.registrationStatus}function pt(t){return 2===t.requestStatus&&!lt(t)}function lt(t){const e=Date.now();return e<t.creationTime||t.creationTime+t.expiresIn<e+w}function dt(t){const e={requestStatus:1,requestTime:Date.now()};return Object.assign({},t,{authToken:e})}async function gt(t){const e=t,{installationEntry:n,registrationPromise:o}=await X(e);return o?o.catch(console.error):ot(e).catch(console.error),n.fid}
/**
   * @license
   * Copyright 2019 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */async function wt(t,e=!1){const n=t;await mt(n);return(await ot(n,e)).token}async function mt(t){const{registrationPromise:e}=await X(t);e&&await e}
/**
   * @license
   * Copyright 2019 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */async function ht(t,e){const n=yt(t,e),o={method:'DELETE',headers:T(t,e)},s=await k(()=>fetch(n,o));if(!s.ok)throw await S('Delete Installation',s)}function yt(t,{fid:e}){return`${v(t)}/${e}`}
/**
   * @license
   * Copyright 2019 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */async function bt(t){const{appConfig:e}=t,n=await W(e,t=>{if(!t||0!==t.registrationStatus)return t});if(n){if(1===n.registrationStatus)throw y.create("delete-pending-registration");if(2===n.registrationStatus){if(!navigator.onLine)throw y.create("app-offline");await ht(e,n),await Q(e)}}}
/**
   * @license
   * Copyright 2019 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */function vt(t,e){const{appConfig:n}=t;return F(n,e),()=>{V(n,e)}}
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */function Ct(e=(0,t.getApp)()){return(0,t._getProvider)(e,'installations').getImmediate()}
/**
   * @license
   * Copyright 2019 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */function St(t){if(!t||!t.options)throw It('App Configuration');if(!t.name)throw It('App Name');const e=['projectId','apiKey','appId'];for(const n of e)if(!t.options[n])throw It(n);return{appName:t.name,projectId:t.options.projectId,apiKey:t.options.apiKey,appId:t.options.appId}}function It(t){return y.create("missing-app-config-values",{valueName:t})}
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */const Tt='installations',kt=e=>{const n=e.getProvider('app').getImmediate();return{app:n,appConfig:St(n),heartbeatServiceProvider:(0,t._getProvider)(n,'heartbeat'),_delete:()=>Promise.resolve()}},Pt=e=>{const n=e.getProvider('app').getImmediate(),o=(0,t._getProvider)(n,Tt).getImmediate();return{getId:()=>gt(o),getToken:t=>wt(o,t)}};(0,t._registerComponent)(new e.Component(Tt,kt,"PUBLIC")),(0,t._registerComponent)(new e.Component("installations-internal",Pt,"PRIVATE")),(0,t.registerVersion)(s,u),(0,t.registerVersion)(s,u,'esm2020')},1355,[794,795,796,799]);