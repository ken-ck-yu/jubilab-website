/* Basic consent mode; flag true = Advanced (launch-checklist s7) */
(function(){
var LOAD_GOOGLE_BEFORE_CONSENT=false,ID="G-8W2MDQ58PL",K="jubilab-consent",L,B,d=document;
function load(){if(L)return;L=1;var s=d.createElement("script");s.async=1;s.src="https://www.googletagmanager.com/gtag/js?id="+ID;d.head.appendChild(s);gtag("js",new Date());gtag("config",ID)}
function up(v){gtag("consent","update",{analytics_storage:v})}
function put(v){try{localStorage.setItem(K,JSON.stringify({v:v,t:Date.now()}))}catch(e){}}
function hide(){B.hidden=1}
function show(){
if(B)B.remove();
d.body.insertAdjacentHTML("beforeend",'<div class=cookie-notice role=region aria-label="Cookie notice"><p>We use Google Analytics, which sets cookies, to count visits. It only runs if you accept. Cloudflare\'s cookieless analytics always runs. <a href=/privacy/>Details in the privacy page</a>.</p><div><button>Accept analytics</button><button>Decline</button></div></div>');
B=d.body.lastChild;
var b=B.querySelectorAll("button");
b[0].onclick=function(){put("granted");up("granted");load();hide()};
b[1].onclick=function(){if(b[0].hidden)return hide();put("denied");up("denied");
d.cookie.split(";").forEach(function(c){c=c.split("=")[0].trim();if(!c.indexOf("_ga"))["","domain="+location.hostname].forEach(function(x){d.cookie=c+"=;path=/;max-age=0;"+x})});
if(L){B.firstChild.textContent="Analytics is off. Reload to unload Google's script.";b[0].hidden=1;b[1].textContent="Close";b[1].focus()}else hide()}}
if(LOAD_GOOGLE_BEFORE_CONSENT)load();
var c;try{c=JSON.parse(localStorage.getItem(K));c=c&&Date.now()-c.t<15552e6&&c.v}catch(e){}
if(c=="granted"){up(c);load()}else if(c!="denied")show();
var f=d.querySelector("footer ul"),a=d.createElement("a"),i=d.createElement("li");
a.href="#";a.textContent="Cookie settings";a.onclick=function(e){e.preventDefault();show();B.querySelector("button").focus()};
i.appendChild(a);f&&f.appendChild(i)
})();
