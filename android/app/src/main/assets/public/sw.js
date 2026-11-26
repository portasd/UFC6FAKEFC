/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-25613826'], (function (workbox) { 'use strict';

  self.skipWaiting();
  workbox.clientsClaim();
  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "pwa-maskable-512x512.png",
    "revision": "2872776b96c3ff6af9e68e70da21cc01"
  }, {
    "url": "pwa-512x512.png",
    "revision": "cbb322c1f911cd9f6921421791c49257"
  }, {
    "url": "pwa-192x192.png",
    "revision": "1386e2e12dcdbe27cdee8e989ae57e9f"
  }, {
    "url": "index.html",
    "revision": "852d540431ce56a8655f7f6e4e5c9bcd"
  }, {
    "url": "icon.svg",
    "revision": "a5728f002966ea6e38e5c78932fbb142"
  }, {
    "url": "apple-touch-icon.png",
    "revision": "92b8e7430acb50728c0753c8d45c8957"
  }, {
    "url": "assets/workbox-window.prod.es5-Bd17z0YL.js",
    "revision": null
  }, {
    "url": "assets/index-Dc5wvTp7.css",
    "revision": null
  }, {
    "url": "assets/index-CZ0hq_ZU.js",
    "revision": null
  }, {
    "url": "assets/faces/yan.png",
    "revision": null
  }, {
    "url": "assets/faces/whittaker.png",
    "revision": null
  }, {
    "url": "assets/faces/volkov.png",
    "revision": null
  }, {
    "url": "assets/faces/volkanovski.png",
    "revision": null
  }, {
    "url": "assets/faces/usman.png",
    "revision": null
  }, {
    "url": "assets/faces/tsarukyan.png",
    "revision": null
  }, {
    "url": "assets/faces/topuria.png",
    "revision": null
  }, {
    "url": "assets/faces/thompson.png",
    "revision": null
  }, {
    "url": "assets/faces/strickland.png",
    "revision": null
  }, {
    "url": "assets/faces/sandhagen.png",
    "revision": null
  }, {
    "url": "assets/faces/rountree.png",
    "revision": null
  }, {
    "url": "assets/faces/rodriguez.png",
    "revision": null
  }, {
    "url": "assets/faces/rakhmonov.png",
    "revision": null
  }, {
    "url": "assets/faces/prochazka.png",
    "revision": null
  }, {
    "url": "assets/faces/poirier.png",
    "revision": null
  }, {
    "url": "assets/faces/pereira.png",
    "revision": null
  }, {
    "url": "assets/faces/pavlovich.png",
    "revision": null
  }, {
    "url": "assets/faces/omalley.png",
    "revision": null
  }, {
    "url": "assets/faces/oliveira.png",
    "revision": null
  }, {
    "url": "assets/faces/nurmagomedovUmar.png",
    "revision": null
  }, {
    "url": "assets/faces/ngannou.png",
    "revision": null
  }, {
    "url": "assets/faces/muhammad.png",
    "revision": null
  }, {
    "url": "assets/faces/mcgregor.png",
    "revision": null
  }, {
    "url": "assets/faces/makhachev.png",
    "revision": null
  }, {
    "url": "assets/faces/lopes.png",
    "revision": null
  }, {
    "url": "assets/faces/khabib.png",
    "revision": null
  }, {
    "url": "assets/faces/jung.png",
    "revision": null
  }, {
    "url": "assets/faces/jones.png",
    "revision": null
  }, {
    "url": "assets/faces/imavov.png",
    "revision": null
  }, {
    "url": "assets/faces/hooker.png",
    "revision": null
  }, {
    "url": "assets/faces/holloway.png",
    "revision": null
  }, {
    "url": "assets/faces/hill.png",
    "revision": null
  }, {
    "url": "assets/faces/gane.png",
    "revision": null
  }, {
    "url": "assets/faces/gaethje.png",
    "revision": null
  }, {
    "url": "assets/faces/fiziev.png",
    "revision": null
  }, {
    "url": "assets/faces/figueiredo.png",
    "revision": null
  }, {
    "url": "assets/faces/evloev.png",
    "revision": null
  }, {
    "url": "assets/faces/edwards.png",
    "revision": null
  }, {
    "url": "assets/faces/dvalishvili.png",
    "revision": null
  }, {
    "url": "assets/faces/duplessis.png",
    "revision": null
  }, {
    "url": "assets/faces/diaz.png",
    "revision": null
  }, {
    "url": "assets/faces/dellamaddalena.png",
    "revision": null
  }, {
    "url": "assets/faces/costa.png",
    "revision": null
  }, {
    "url": "assets/faces/chimaev.png",
    "revision": null
  }, {
    "url": "assets/faces/chandler.png",
    "revision": null
  }, {
    "url": "assets/faces/barboza.png",
    "revision": null
  }, {
    "url": "assets/faces/aspinall.png",
    "revision": null
  }, {
    "url": "assets/faces/ankalaev.png",
    "revision": null
  }, {
    "url": "assets/faces/adesanya.png",
    "revision": null
  }, {
    "url": "assets/aistudio/image_cbbf5e52.png",
    "revision": null
  }, {
    "url": "assets/aistudio/image_c94e6796.png",
    "revision": null
  }, {
    "url": "assets/aistudio/image_be46701d.png",
    "revision": null
  }, {
    "url": "assets/aistudio/image_79d24a09.png",
    "revision": null
  }, {
    "url": "assets/aistudio/image_721756e8.png",
    "revision": null
  }, {
    "url": "assets/aistudio/image_3d002f40.png",
    "revision": null
  }, {
    "url": "assets/aistudio/image_2778c633.png",
    "revision": null
  }, {
    "url": "assets/aistudio/image_0a02e180.png",
    "revision": null
  }, {
    "url": "assets/aistudio/OFC_ad5be42d.png",
    "revision": null
  }, {
    "url": "apple-touch-icon.png",
    "revision": "92b8e7430acb50728c0753c8d45c8957"
  }, {
    "url": "pwa-192x192.png",
    "revision": "1386e2e12dcdbe27cdee8e989ae57e9f"
  }, {
    "url": "pwa-512x512.png",
    "revision": "cbb322c1f911cd9f6921421791c49257"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "2872776b96c3ff6af9e68e70da21cc01"
  }, {
    "url": "manifest.webmanifest",
    "revision": "e2ac0feba55a172be239408879b61748"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("index.html")));
  workbox.registerRoute(/^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "google-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 12,
      maxAgeSeconds: 31536000
    })]
  }), 'GET');

}));
