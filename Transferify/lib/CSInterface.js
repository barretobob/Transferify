function CSInterface(){}
CSInterface.prototype.evalScript=function(script,cb){window.__adobe_cep__.evalScript(script,cb||function(){});};
CSInterface.prototype.getHostEnvironment=function(){return JSON.parse(window.__adobe_cep__.getHostEnvironment());};
CSInterface.prototype.getSystemPath=function(pathType){var p=decodeURI(window.__adobe_cep__.getSystemPath(pathType));if(/^file:\/\//i.test(p))p=p.substring(7);if(/^\/[A-Za-z]:\//.test(p))p=p.substring(1);return p;};
CSInterface.prototype.openURLInDefaultBrowser=function(url){window.__adobe_cep__.openURLInDefaultBrowser(url);};
var SystemPath={USER_DATA:"userData",COMMON_FILES:"commonFiles",MY_DOCUMENTS:"myDocuments",APPLICATION:"application",EXTENSION:"extension",HOST_APPLICATION:"hostApplication"};