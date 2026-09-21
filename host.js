'use strict';

// Azure App Service Stack settings still run `node host.js` from the old
// combined site. Keep this entry so that command starts the Next app.
require('./start-next.js');
