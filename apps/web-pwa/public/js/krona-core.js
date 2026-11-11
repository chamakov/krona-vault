/* QRCODE_EMBEDDED */
if (typeof window !== "undefined" && typeof window.qrcode === "undefined") {
  var qrcode=function(){function i(t,r){function a(t,r){g=function(t){for(var r=new Array(t),e=0;e<t;e+=1){r[e]=new Array(t);for(var n=0;n<t;n+=1)r[e][n]=null}return r}(l=4*u+17),e(0,0),e(l-7,0),e(0,l-7),i(),o(),v(t,r),7<=u&&h(t),null==n&&(n=w(u,f,c)),d(n,r)}var u=t,f=y[r],g=null,l=0,n=null,c=[],s={},e=function(t,r){for(var e=-1;e<=7;e+=1)if(!(t+e<=-1||l<=t+e))for(var n=-1;n<=7;n+=1)r+n<=-1||l<=r+n||(g[t+e][r+n]=0<=e&&e<=6&&(0==n||6==n)||0<=n&&n<=6&&(0==e||6==e)||2<=e&&e<=4&&2<=n&&n<=4)},o=function(){for(var t=8;t<l-8;t+=1)null==g[t][6]&&(g[t][6]=t%2==0);for(var r=8;r<l-8;r+=1)null==g[6][r]&&(g[6][r]=r%2==0)},i=function(){for(var t=B.getPatternPosition(u),r=0;r<t.length;r+=1)for(var e=0;e<t.length;e+=1){var n=t[r],o=t[e];if(null==g[n][o])for(var i=-2;i<=2;i+=1)for(var a=-2;a<=2;a+=1)g[n+i][o+a]=-2==i||2==i||-2==a||2==a||0==i&&0==a}},h=function(t){for(var r=B.getBCHTypeNumber(u),e=0;e<18;e+=1){var n=!t&&1==(r>>e&1);g[Math.floor(e/3)][e%3+l-8-3]=n}for(e=0;e<18;e+=1){n=!t&&1==(r>>e&1);g[e%3+l-8-3][Math.floor(e/3)]=n}},v=function(t,r){for(var e=f<<3|r,n=B.getBCHTypeInfo(e),o=0;o<15;o+=1){var i=!t&&1==(n>>o&1);o<6?g[o][8]=i:o<8?g[o+1][8]=i:g[l-15+o][8]=i}for(o=0;o<15;o+=1){i=!t&&1==(n>>o&1);o<8?g[8][l-o-1]=i:o<9?g[8][15-o-1+1]=i:g[8][15-o-1]=i}g[l-8][8]=!t},d=function(t,r){for(var e=-1,n=l-1,o=7,i=0,a=B.getMaskFunction(r),u=l-1;0<u;u-=2)for(6==u&&(u-=1);;){for(var f=0;f<2;f+=1)if(null==g[n][u-f]){var c=!1;i<t.length&&(c=1==(t[i]>>>o&1)),a(n,u-f)&&(c=!c),g[n][u-f]=c,-1==(o-=1)&&(i+=1,o=7)}if((n+=e)<0||l<=n){n-=e,e=-e;break}}},w=function(t,r,e){for(var n=b.getRSBlocks(t,r),o=M(),i=0;i<e.length;i+=1){var a=e[i];o.put(a.getMode(),4),o.put(a.getLength(),B.getLengthInBits(a.getMode(),t)),a.write(o)}var u=0;for(i=0;i<n.length;i+=1)u+=n[i].dataCount;if(o.getLengthInBits()>8*u)throw"code length overflow. ("+o.getLengthInBits()+">"+8*u+")";for(o.getLengthInBits()+4<=8*u&&o.put(0,4);o.getLengthInBits()%8!=0;)o.putBit(!1);for(;!(o.getLengthInBits()>=8*u||(o.put(236,8),o.getLengthInBits()>=8*u));)o.put(17,8);return function(t,r){for(var e=0,n=0,o=0,i=new Array(r.length),a=new Array(r.length),u=0;u<r.length;u+=1){var f=r[u].dataCount,c=r[u].totalCount-f;n=Math.max(n,f),o=Math.max(o,c),i[u]=new Array(f);for(var g=0;g<i[u].length;g+=1)i[u][g]=255&t.getBuffer()[g+e];e+=f;var l=B.getErrorCorrectPolynomial(c),h=C(i[u],l.getLength()-1).mod(l);a[u]=new Array(l.getLength()-1);for(g=0;g<a[u].length;g+=1){var s=g+h.getLength()-a[u].length;a[u][g]=0<=s?h.getAt(s):0}}var v=0;for(g=0;g<r.length;g+=1)v+=r[g].totalCount;var d=new Array(v),w=0;for(g=0;g<n;g+=1)for(u=0;u<r.length;u+=1)g<i[u].length&&(d[w]=i[u][g],w+=1);for(g=0;g<o;g+=1)for(u=0;u<r.length;u+=1)g<a[u].length&&(d[w]=a[u][g],w+=1);return d}(o,n)};s.addData=function(t,r){var e=null;switch(r=r||"Byte"){case"Numeric":e=x(t);break;case"Alphanumeric":e=m(t);break;case"Byte":e=L(t);break;case"Kanji":e=D(t);break;default:throw"mode:"+r}c.push(e),n=null},s.isDark=function(t,r){if(t<0||l<=t||r<0||l<=r)throw t+","+r;return g[t][r]},s.getModuleCount=function(){return l},s.make=function(){if(u<1){for(var t=1;t<40;t++){for(var r=b.getRSBlocks(t,f),e=M(),n=0;n<c.length;n++){var o=c[n];e.put(o.getMode(),4),e.put(o.getLength(),B.getLengthInBits(o.getMode(),t)),o.write(e)}var i=0;for(n=0;n<r.length;n++)i+=r[n].dataCount;if(e.getLengthInBits()<=8*i)break}u=t}a(!1,function(){for(var t=0,r=0,e=0;e<8;e+=1){a(!0,e);var n=B.getLostPoint(s);(0==e||n<t)&&(t=n,r=e)}return r}())},s.createTableTag=function(t,r){t=t||2;var e="";e+='<table style="',e+=" border-width: 0px; border-style: none;",e+=" border-collapse: collapse;",e+=" padding: 0px; margin: "+(r=void 0===r?4*t:r)+"px;",e+='">',e+="<tbody>";for(var n=0;n<s.getModuleCount();n+=1){e+="<tr>";for(var o=0;o<s.getModuleCount();o+=1)e+='<td style="',e+=" border-width: 0px; border-style: none;",e+=" border-collapse: collapse;",e+=" padding: 0px; margin: 0px;",e+=" width: "+t+"px;",e+=" height: "+t+"px;",e+=" background-color: ",e+=s.isDark(n,o)?"#000000":"#ffffff",e+=";",e+='"/>';e+="</tr>"}return e+="</tbody>",e+="</table>"},s.createSvgTag=function(t,r,e,n){var o={};"object"==typeof t&&(t=(o=t).cellSize,r=o.margin,e=o.alt,n=o.title),t=t||2,r=void 0===r?4*t:r,(e="string"==typeof e?{text:e}:e||{}).text=e.text||null,e.id=e.text?e.id||"qrcode-description":null,(n="string"==typeof n?{text:n}:n||{}).text=n.text||null,n.id=n.text?n.id||"qrcode-title":null;var i,a,u,f,c=s.getModuleCount()*t+2*r,g="";for(f="l"+t+",0 0,"+t+" -"+t+",0 0,-"+t+"z ",g+='<svg version="1.1" xmlns="http://www.w3.org/2000/svg"',g+=o.scalable?"":' width="'+c+'px" height="'+c+'px"',g+=' viewBox="0 0 '+c+" "+c+'" ',g+=' preserveAspectRatio="xMinYMin meet"',g+=n.text||e.text?' role="img" aria-labelledby="'+p([n.id,e.id].join(" ").trim())+'"':"",g+=">",g+=n.text?'<title id="'+p(n.id)+'">'+p(n.text)+"</title>":"",g+=e.text?'<description id="'+p(e.id)+'">'+p(e.text)+"</description>":"",g+='<rect width="100%" height="100%" fill="white" cx="0" cy="0"/>',g+='<path d="',a=0;a<s.getModuleCount();a+=1)for(u=a*t+r,i=0;i<s.getModuleCount();i+=1)s.isDark(a,i)&&(g+="M"+(i*t+r)+","+u+f);return g+='" stroke="transparent" fill="black"/>',g+="</svg>"},s.createDataURL=function(o,t){o=o||2,t=void 0===t?4*o:t;var r=s.getModuleCount()*o+2*t,i=t,a=r-t;return I(r,r,function(t,r){if(i<=t&&t<a&&i<=r&&r<a){var e=Math.floor((t-i)/o),n=Math.floor((r-i)/o);return s.isDark(n,e)?0:1}return 1})},s.createImgTag=function(t,r,e){t=t||2,r=void 0===r?4*t:r;var n=s.getModuleCount()*t+2*r,o="";return o+="<img",o+=' src="',o+=s.createDataURL(t,r),o+='"',o+=' width="',o+=n,o+='"',o+=' height="',o+=n,o+='"',e&&(o+=' alt="',o+=p(e),o+='"'),o+="/>"};var p=function(t){for(var r="",e=0;e<t.length;e+=1){var n=t.charAt(e);switch(n){case"<":r+="&lt;";break;case">":r+="&gt;";break;case"&":r+="&amp;";break;case'"':r+="&quot;";break;default:r+=n}}return r};return s.createASCII=function(t,r){if((t=t||1)<2)return function(t){t=void 0===t?2:t;var r,e,n,o,i,a=1*s.getModuleCount()+2*t,u=t,f=a-t,c={"██":"█","█ ":"▀"," █":"▄","  ":" "},g={"██":"▀","█ ":"▀"," █":" ","  ":" "},l="";for(r=0;r<a;r+=2){for(n=Math.floor((r-u)/1),o=Math.floor((r+1-u)/1),e=0;e<a;e+=1)i="█",u<=e&&e<f&&u<=r&&r<f&&s.isDark(n,Math.floor((e-u)/1))&&(i=" "),u<=e&&e<f&&u<=r+1&&r+1<f&&s.isDark(o,Math.floor((e-u)/1))?i+=" ":i+="█",l+=t<1&&f<=r+1?g[i]:c[i];l+="\n"}return a%2&&0<t?l.substring(0,l.length-a-1)+Array(1+a).join("▀"):l.substring(0,l.length-1)}(r);t-=1,r=void 0===r?2*t:r;var e,n,o,i,a=s.getModuleCount()*t+2*r,u=r,f=a-r,c=Array(t+1).join("██"),g=Array(t+1).join("  "),l="",h="";for(e=0;e<a;e+=1){for(o=Math.floor((e-u)/t),h="",n=0;n<a;n+=1)i=1,u<=n&&n<f&&u<=e&&e<f&&s.isDark(o,Math.floor((n-u)/t))&&(i=0),h+=i?c:g;for(o=0;o<t;o+=1)l+=h+"\n"}return l.substring(0,l.length-1)},s.renderTo2dContext=function(t,r){r=r||2;for(var e=s.getModuleCount(),n=0;n<e;n++)for(var o=0;o<e;o++)t.fillStyle=s.isDark(n,o)?"black":"white",t.fillRect(n*r,o*r,r,r)},s}i.stringToBytes=(i.stringToBytesFuncs={default:function(t){for(var r=[],e=0;e<t.length;e+=1){var n=t.charCodeAt(e);r.push(255&n)}return r}}).default,i.createStringToBytes=function(u,f){var i=function(){function t(){var t=r.read();if(-1==t)throw"eof";return t}for(var r=S(u),e=0,n={};;){var o=r.read();if(-1==o)break;var i=t(),a=t()<<8|t();n[String.fromCharCode(o<<8|i)]=a,e+=1}if(e!=f)throw e+" != "+f;return n}(),a="?".charCodeAt(0);return function(t){for(var r=[],e=0;e<t.length;e+=1){var n=t.charCodeAt(e);if(n<128)r.push(n);else{var o=i[t.charAt(e)];"number"==typeof o?(255&o)==o?r.push(o):(r.push(o>>>8),r.push(255&o)):r.push(a)}}return r}};var r,t,a=1,u=2,o=4,f=8,y={L:1,M:0,Q:3,H:2},e=0,n=1,c=2,g=3,l=4,h=5,s=6,v=7,B=(r=[[],[6,18],[6,22],[6,26],[6,30],[6,34],[6,22,38],[6,24,42],[6,26,46],[6,28,50],[6,30,54],[6,32,58],[6,34,62],[6,26,46,66],[6,26,48,70],[6,26,50,74],[6,30,54,78],[6,30,56,82],[6,30,58,86],[6,34,62,90],[6,28,50,72,94],[6,26,50,74,98],[6,30,54,78,102],[6,28,54,80,106],[6,32,58,84,110],[6,30,58,86,114],[6,34,62,90,118],[6,26,50,74,98,122],[6,30,54,78,102,126],[6,26,52,78,104,130],[6,30,56,82,108,134],[6,34,60,86,112,138],[6,30,58,86,114,142],[6,34,62,90,118,146],[6,30,54,78,102,126,150],[6,24,50,76,102,128,154],[6,28,54,80,106,132,158],[6,32,58,84,110,136,162],[6,26,54,82,110,138,166],[6,30,58,86,114,142,170]],(t={}).getBCHTypeInfo=function(t){for(var r=t<<10;0<=d(r)-d(1335);)r^=1335<<d(r)-d(1335);return 21522^(t<<10|r)},t.getBCHTypeNumber=function(t){for(var r=t<<12;0<=d(r)-d(7973);)r^=7973<<d(r)-d(7973);return t<<12|r},t.getPatternPosition=function(t){return r[t-1]},t.getMaskFunction=function(t){switch(t){case e:return function(t,r){return(t+r)%2==0};case n:return function(t,r){return t%2==0};case c:return function(t,r){return r%3==0};case g:return function(t,r){return(t+r)%3==0};case l:return function(t,r){return(Math.floor(t/2)+Math.floor(r/3))%2==0};case h:return function(t,r){return t*r%2+t*r%3==0};case s:return function(t,r){return(t*r%2+t*r%3)%2==0};case v:return function(t,r){return(t*r%3+(t+r)%2)%2==0};default:throw"bad maskPattern:"+t}},t.getErrorCorrectPolynomial=function(t){for(var r=C([1],0),e=0;e<t;e+=1)r=r.multiply(C([1,w.gexp(e)],0));return r},t.getLengthInBits=function(t,r){if(1<=r&&r<10)switch(t){case a:return 10;case u:return 9;case o:case f:return 8;default:throw"mode:"+t}else if(r<27)switch(t){case a:return 12;case u:return 11;case o:return 16;case f:return 10;default:throw"mode:"+t}else{if(!(r<41))throw"type:"+r;switch(t){case a:return 14;case u:return 13;case o:return 16;case f:return 12;default:throw"mode:"+t}}},t.getLostPoint=function(t){for(var r=t.getModuleCount(),e=0,n=0;n<r;n+=1)for(var o=0;o<r;o+=1){for(var i=0,a=t.isDark(n,o),u=-1;u<=1;u+=1)if(!(n+u<0||r<=n+u))for(var f=-1;f<=1;f+=1)o+f<0||r<=o+f||0==u&&0==f||a==t.isDark(n+u,o+f)&&(i+=1);5<i&&(e+=3+i-5)}for(n=0;n<r-1;n+=1)for(o=0;o<r-1;o+=1){var c=0;t.isDark(n,o)&&(c+=1),t.isDark(n+1,o)&&(c+=1),t.isDark(n,o+1)&&(c+=1),t.isDark(n+1,o+1)&&(c+=1),0!=c&&4!=c||(e+=3)}for(n=0;n<r;n+=1)for(o=0;o<r-6;o+=1)t.isDark(n,o)&&!t.isDark(n,o+1)&&t.isDark(n,o+2)&&t.isDark(n,o+3)&&t.isDark(n,o+4)&&!t.isDark(n,o+5)&&t.isDark(n,o+6)&&(e+=40);for(o=0;o<r;o+=1)for(n=0;n<r-6;n+=1)t.isDark(n,o)&&!t.isDark(n+1,o)&&t.isDark(n+2,o)&&t.isDark(n+3,o)&&t.isDark(n+4,o)&&!t.isDark(n+5,o)&&t.isDark(n+6,o)&&(e+=40);var g=0;for(o=0;o<r;o+=1)for(n=0;n<r;n+=1)t.isDark(n,o)&&(g+=1);return e+=Math.abs(100*g/r/r-50)/5*10},t);function d(t){for(var r=0;0!=t;)r+=1,t>>>=1;return r}var w=function(){for(var r=new Array(256),e=new Array(256),t=0;t<8;t+=1)r[t]=1<<t;for(t=8;t<256;t+=1)r[t]=r[t-4]^r[t-5]^r[t-6]^r[t-8];for(t=0;t<255;t+=1)e[r[t]]=t;var n={glog:function(t){if(t<1)throw"glog("+t+")";return e[t]},gexp:function(t){for(;t<0;)t+=255;for(;256<=t;)t-=255;return r[t]}};return n}();function C(n,o){if(void 0===n.length)throw n.length+"/"+o;var r=function(){for(var t=0;t<n.length&&0==n[t];)t+=1;for(var r=new Array(n.length-t+o),e=0;e<n.length-t;e+=1)r[e]=n[e+t];return r}(),i={getAt:function(t){return r[t]},getLength:function(){return r.length},multiply:function(t){for(var r=new Array(i.getLength()+t.getLength()-1),e=0;e<i.getLength();e+=1)for(var n=0;n<t.getLength();n+=1)r[e+n]^=w.gexp(w.glog(i.getAt(e))+w.glog(t.getAt(n)));return C(r,0)},mod:function(t){if(i.getLength()-t.getLength()<0)return i;for(var r=w.glog(i.getAt(0))-w.glog(t.getAt(0)),e=new Array(i.getLength()),n=0;n<i.getLength();n+=1)e[n]=i.getAt(n);for(n=0;n<t.getLength();n+=1)e[n]^=w.gexp(w.glog(t.getAt(n))+r);return C(e,0).mod(t)}};return i}function p(){var e=[],o={writeByte:function(t){e.push(255&t)},writeShort:function(t){o.writeByte(t),o.writeByte(t>>>8)},writeBytes:function(t,r,e){r=r||0,e=e||t.length;for(var n=0;n<e;n+=1)o.writeByte(t[n+r])},writeString:function(t){for(var r=0;r<t.length;r+=1)o.writeByte(t.charCodeAt(r))},toByteArray:function(){return e},toString:function(){var t="";t+="[";for(var r=0;r<e.length;r+=1)0<r&&(t+=","),t+=e[r];return t+="]"}};return o}var k,A,b=(k=[[1,26,19],[1,26,16],[1,26,13],[1,26,9],[1,44,34],[1,44,28],[1,44,22],[1,44,16],[1,70,55],[1,70,44],[2,35,17],[2,35,13],[1,100,80],[2,50,32],[2,50,24],[4,25,9],[1,134,108],[2,67,43],[2,33,15,2,34,16],[2,33,11,2,34,12],[2,86,68],[4,43,27],[4,43,19],[4,43,15],[2,98,78],[4,49,31],[2,32,14,4,33,15],[4,39,13,1,40,14],[2,121,97],[2,60,38,2,61,39],[4,40,18,2,41,19],[4,40,14,2,41,15],[2,146,116],[3,58,36,2,59,37],[4,36,16,4,37,17],[4,36,12,4,37,13],[2,86,68,2,87,69],[4,69,43,1,70,44],[6,43,19,2,44,20],[6,43,15,2,44,16],[4,101,81],[1,80,50,4,81,51],[4,50,22,4,51,23],[3,36,12,8,37,13],[2,116,92,2,117,93],[6,58,36,2,59,37],[4,46,20,6,47,21],[7,42,14,4,43,15],[4,133,107],[8,59,37,1,60,38],[8,44,20,4,45,21],[12,33,11,4,34,12],[3,145,115,1,146,116],[4,64,40,5,65,41],[11,36,16,5,37,17],[11,36,12,5,37,13],[5,109,87,1,110,88],[5,65,41,5,66,42],[5,54,24,7,55,25],[11,36,12,7,37,13],[5,122,98,1,123,99],[7,73,45,3,74,46],[15,43,19,2,44,20],[3,45,15,13,46,16],[1,135,107,5,136,108],[10,74,46,1,75,47],[1,50,22,15,51,23],[2,42,14,17,43,15],[5,150,120,1,151,121],[9,69,43,4,70,44],[17,50,22,1,51,23],[2,42,14,19,43,15],[3,141,113,4,142,114],[3,70,44,11,71,45],[17,47,21,4,48,22],[9,39,13,16,40,14],[3,135,107,5,136,108],[3,67,41,13,68,42],[15,54,24,5,55,25],[15,43,15,10,44,16],[4,144,116,4,145,117],[17,68,42],[17,50,22,6,51,23],[19,46,16,6,47,17],[2,139,111,7,140,112],[17,74,46],[7,54,24,16,55,25],[34,37,13],[4,151,121,5,152,122],[4,75,47,14,76,48],[11,54,24,14,55,25],[16,45,15,14,46,16],[6,147,117,4,148,118],[6,73,45,14,74,46],[11,54,24,16,55,25],[30,46,16,2,47,17],[8,132,106,4,133,107],[8,75,47,13,76,48],[7,54,24,22,55,25],[22,45,15,13,46,16],[10,142,114,2,143,115],[19,74,46,4,75,47],[28,50,22,6,51,23],[33,46,16,4,47,17],[8,152,122,4,153,123],[22,73,45,3,74,46],[8,53,23,26,54,24],[12,45,15,28,46,16],[3,147,117,10,148,118],[3,73,45,23,74,46],[4,54,24,31,55,25],[11,45,15,31,46,16],[7,146,116,7,147,117],[21,73,45,7,74,46],[1,53,23,37,54,24],[19,45,15,26,46,16],[5,145,115,10,146,116],[19,75,47,10,76,48],[15,54,24,25,55,25],[23,45,15,25,46,16],[13,145,115,3,146,116],[2,74,46,29,75,47],[42,54,24,1,55,25],[23,45,15,28,46,16],[17,145,115],[10,74,46,23,75,47],[10,54,24,35,55,25],[19,45,15,35,46,16],[17,145,115,1,146,116],[14,74,46,21,75,47],[29,54,24,19,55,25],[11,45,15,46,46,16],[13,145,115,6,146,116],[14,74,46,23,75,47],[44,54,24,7,55,25],[59,46,16,1,47,17],[12,151,121,7,152,122],[12,75,47,26,76,48],[39,54,24,14,55,25],[22,45,15,41,46,16],[6,151,121,14,152,122],[6,75,47,34,76,48],[46,54,24,10,55,25],[2,45,15,64,46,16],[17,152,122,4,153,123],[29,74,46,14,75,47],[49,54,24,10,55,25],[24,45,15,46,46,16],[4,152,122,18,153,123],[13,74,46,32,75,47],[48,54,24,14,55,25],[42,45,15,32,46,16],[20,147,117,4,148,118],[40,75,47,7,76,48],[43,54,24,22,55,25],[10,45,15,67,46,16],[19,148,118,6,149,119],[18,75,47,31,76,48],[34,54,24,34,55,25],[20,45,15,61,46,16]],(A={}).getRSBlocks=function(t,r){var e=function(t,r){switch(r){case y.L:return k[4*(t-1)+0];case y.M:return k[4*(t-1)+1];case y.Q:return k[4*(t-1)+2];case y.H:return k[4*(t-1)+3];default:return}}(t,r);if(void 0===e)throw"bad rs block @ typeNumber:"+t+"/errorCorrectionLevel:"+r;for(var n,o,i=e.length/3,a=[],u=0;u<i;u+=1)for(var f=e[3*u+0],c=e[3*u+1],g=e[3*u+2],l=0;l<f;l+=1)a.push((n=g,o=void 0,(o={}).totalCount=c,o.dataCount=n,o));return a},A),M=function(){var e=[],n=0,o={getBuffer:function(){return e},getAt:function(t){var r=Math.floor(t/8);return 1==(e[r]>>>7-t%8&1)},put:function(t,r){for(var e=0;e<r;e+=1)o.putBit(1==(t>>>r-e-1&1))},getLengthInBits:function(){return n},putBit:function(t){var r=Math.floor(n/8);e.length<=r&&e.push(0),t&&(e[r]|=128>>>n%8),n+=1}};return o},x=function(t){var r=a,n=t,e={getMode:function(){return r},getLength:function(t){return n.length},write:function(t){for(var r=n,e=0;e+2<r.length;)t.put(o(r.substring(e,e+3)),10),e+=3;e<r.length&&(r.length-e==1?t.put(o(r.substring(e,e+1)),4):r.length-e==2&&t.put(o(r.substring(e,e+2)),7))}},o=function(t){for(var r=0,e=0;e<t.length;e+=1)r=10*r+i(t.charAt(e));return r},i=function(t){if("0"<=t&&t<="9")return t.charCodeAt(0)-"0".charCodeAt(0);throw"illegal char :"+t};return e},m=function(t){var r=u,n=t,e={getMode:function(){return r},getLength:function(t){return n.length},write:function(t){for(var r=n,e=0;e+1<r.length;)t.put(45*o(r.charAt(e))+o(r.charAt(e+1)),11),e+=2;e<r.length&&t.put(o(r.charAt(e)),6)}},o=function(t){if("0"<=t&&t<="9")return t.charCodeAt(0)-"0".charCodeAt(0);if("A"<=t&&t<="Z")return t.charCodeAt(0)-"A".charCodeAt(0)+10;switch(t){case" ":return 36;case"$":return 37;case"%":return 38;case"*":return 39;case"+":return 40;case"-":return 41;case".":return 42;case"/":return 43;case":":return 44;default:throw"illegal char :"+t}};return e},L=function(t){var r=o,e=i.stringToBytes(t),n={getMode:function(){return r},getLength:function(t){return e.length},write:function(t){for(var r=0;r<e.length;r+=1)t.put(e[r],8)}};return n},D=function(t){var r=f,e=i.stringToBytesFuncs.SJIS;if(!e)throw"sjis not supported.";!function(){var t=e("友");if(2!=t.length||38726!=(t[0]<<8|t[1]))throw"sjis not supported."}();var o=e(t),n={getMode:function(){return r},getLength:function(t){return~~(o.length/2)},write:function(t){for(var r=o,e=0;e+1<r.length;){var n=(255&r[e])<<8|255&r[e+1];if(33088<=n&&n<=40956)n-=33088;else{if(!(57408<=n&&n<=60351))throw"illegal char at "+(e+1)+"/"+n;n-=49472}n=192*(n>>>8&255)+(255&n),t.put(n,13),e+=2}if(e<r.length)throw"illegal char at "+(e+1)}};return n},S=function(t){var e=t,n=0,o=0,i=0,r={read:function(){for(;i<8;){if(n>=e.length){if(0==i)return-1;throw"unexpected end of file./"+i}var t=e.charAt(n);if(n+=1,"="==t)return i=0,-1;t.match(/^\s$/)||(o=o<<6|a(t.charCodeAt(0)),i+=6)}var r=o>>>i-8&255;return i-=8,r}},a=function(t){if(65<=t&&t<=90)return t-65;if(97<=t&&t<=122)return t-97+26;if(48<=t&&t<=57)return t-48+52;if(43==t)return 62;if(47==t)return 63;throw"c:"+t};return r},I=function(t,r,e){for(var n=function(t,r){var n=t,o=r,l=new Array(t*r),e={setPixel:function(t,r,e){l[r*n+t]=e},write:function(t){t.writeString("GIF87a"),t.writeShort(n),t.writeShort(o),t.writeByte(128),t.writeByte(0),t.writeByte(0),t.writeByte(0),t.writeByte(0),t.writeByte(0),t.writeByte(255),t.writeByte(255),t.writeByte(255),t.writeString(","),t.writeShort(0),t.writeShort(0),t.writeShort(n),t.writeShort(o),t.writeByte(0);var r=i(2);t.writeByte(2);for(var e=0;255<r.length-e;)t.writeByte(255),t.writeBytes(r,e,255),e+=255;t.writeByte(r.length-e),t.writeBytes(r,e,r.length-e),t.writeByte(0),t.writeString(";")}},i=function(t){for(var r=1<<t,e=1+(1<<t),n=t+1,o=h(),i=0;i<r;i+=1)o.add(String.fromCharCode(i));o.add(String.fromCharCode(r)),o.add(String.fromCharCode(e));var a=p(),u=function(t){var e=t,n=0,o=0,r={write:function(t,r){if(t>>>r!=0)throw"length over";for(;8<=n+r;)e.writeByte(255&(t<<n|o)),r-=8-n,t>>>=8-n,n=o=0;o|=t<<n,n+=r},flush:function(){0<n&&e.writeByte(o)}};return r}(a);u.write(r,n);var f=0,c=String.fromCharCode(l[f]);for(f+=1;f<l.length;){var g=String.fromCharCode(l[f]);f+=1,o.contains(c+g)?c+=g:(u.write(o.indexOf(c),n),o.size()<4095&&(o.size()==1<<n&&(n+=1),o.add(c+g)),c=g)}return u.write(o.indexOf(c),n),u.write(e,n),u.flush(),a.toByteArray()},h=function(){var r={},e=0,n={add:function(t){if(n.contains(t))throw"dup key:"+t;r[t]=e,e+=1},size:function(){return e},indexOf:function(t){return r[t]},contains:function(t){return void 0!==r[t]}};return n};return e}(t,r),o=0;o<r;o+=1)for(var i=0;i<t;i+=1)n.setPixel(i,o,e(i,o));var a=p();n.write(a);for(var u=function(){function e(t){a+=String.fromCharCode(r(63&t))}var n=0,o=0,i=0,a="",t={},r=function(t){if(t<0);else{if(t<26)return 65+t;if(t<52)return t-26+97;if(t<62)return t-52+48;if(62==t)return 43;if(63==t)return 47}throw"n:"+t};return t.writeByte=function(t){for(n=n<<8|255&t,o+=8,i+=1;6<=o;)e(n>>>o-6),o-=6},t.flush=function(){if(0<o&&(e(n<<6-o),o=n=0),i%3!=0)for(var t=3-i%3,r=0;r<t;r+=1)a+="="},t.toString=function(){return a},t}(),f=a.toByteArray(),c=0;c<f.length;c+=1)u.writeByte(f[c]);return u.flush(),"data:image/gif;base64,"+u};return i}();qrcode.stringToBytesFuncs["UTF-8"]=function(t){return function(t){for(var r=[],e=0;e<t.length;e++){var n=t.charCodeAt(e);n<128?r.push(n):n<2048?r.push(192|n>>6,128|63&n):n<55296||57344<=n?r.push(224|n>>12,128|n>>6&63,128|63&n):(e++,n=65536+((1023&n)<<10|1023&t.charCodeAt(e)),r.push(240|n>>18,128|n>>12&63,128|n>>6&63,128|63&n))}return r}(t)},function(t){"function"==typeof define&&define.amd?define([],t):"object"==typeof exports&&(module.exports=t())}(function(){return qrcode});
  if (typeof qrcode !== "undefined") window.qrcode = qrcode;
}

/**
 * KRONA VAULT™ — Core Client Runtime, IAM Session Manager, SVG Icon Engine & Multi-Portal Shell
 * UI/UX Pro Max Certified:
 * - Zero emoji icons in UI chrome (24x24 Lucide/Heroicons SVG set)
 * - Automatic button loading state & double-submit prevention on POST mutations
 * - Stateful session verification & automatic orphan-token purge
 * - Atomic RBAC permission & portal visibility enforcement
 */

window.KronaCore = (function () {
  let latestState = null;
  let onStateChangeCallback = null;
  let currentActiveRoute = '/';

  const SYSTEM_PORTAL_ROUTES = [
    { path: '/', label: 'Nexus Hub', tag: 'Alt+0', iconName: 'grid' },
    { path: '/wallet', label: 'KRONA Pass', tag: 'Alt+1', iconName: 'qr' },
    { path: '/pos', label: 'Terminal POS', tag: 'Alt+2', iconName: 'terminal' },
    { path: '/trade-in', label: 'Trade-In & Bonos', tag: 'Alt+8', iconName: 'cards' },
    { path: '/custody', label: 'Resguardo Bóveda', tag: 'Alt+C', iconName: 'box' },
    { path: '/tournaments', label: 'Premios Torneos', tag: 'Alt+3', iconName: 'trophy' },
    { path: '/stores', label: 'Sedes & Categorías', tag: 'Alt+7', iconName: 'store' },
    { path: '/users', label: 'Usuarios & Roles', tag: 'Alt+5', iconName: 'users' },
    { path: '/profile', label: 'Mi Perfil', tag: 'Alt+6', iconName: 'user' },
    { path: '/audit', label: 'Citadel Audit', tag: 'Alt+4', iconName: 'shield' },
  ];

  const SVG_ICONS = {
    shield: '<svg class="krona-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
    lock: '<svg class="krona-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
    unlock: '<svg class="krona-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>',
    key: '<svg class="krona-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>',
    user: '<svg class="krona-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    users: '<svg class="krona-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    logout: '<svg class="krona-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
    grid: '<svg class="krona-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
    qr: '<svg class="krona-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3zM18 18h3v3h-3zM14 19h2v2h-2zM19 14h2v2h-2z"/></svg>',
    terminal: '<svg class="krona-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="6" y1="8" x2="6.01" y2="8"/><line x1="10" y1="8" x2="10.01" y2="8"/><path d="M6 12h12"/><path d="M6 16h8"/></svg>',
    trophy: '<svg class="krona-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>',
    printer: '<svg class="krona-icon" viewBox="0 0 24 24" aria-hidden="true"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>',
    check: '<svg class="krona-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>',
    alert: '<svg class="krona-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    refresh: '<svg class="krona-icon" viewBox="0 0 24 24" aria-hidden="true"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>',
    search: '<svg class="krona-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    eye: '<svg class="krona-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
    eyeOff: '<svg class="krona-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>',
    plus: '<svg class="krona-icon" viewBox="0 0 24 24" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    bolt: '<svg class="krona-icon" viewBox="0 0 24 24" aria-hidden="true"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
    link: '<svg class="krona-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
    fileText: '<svg class="krona-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
    menu: '<svg class="krona-icon" viewBox="0 0 24 24" aria-hidden="true"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>',
    store: '<svg class="krona-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21h18M3 7v1a3 3 0 0 0 6 0V7m0 1a3 3 0 0 0 6 0V7m0 1a3 3 0 0 0 6 0V7H3l2-4h14l2 4M5 21V10.85M19 21V10.85M9 21v-4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v4"/></svg>',
    cards: '<svg class="krona-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="7" width="16" height="15" rx="2"/><path d="M6 7V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-2"/></svg>',
    edit: '<svg class="krona-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
    trash: '<svg class="krona-icon" viewBox="0 0 24 24" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>',
    box: '<svg class="krona-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>',
    camera: '<svg class="krona-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>',
  };

  function icon(name) {
    return SVG_ICONS[name] || SVG_ICONS.shield;
  }

  const LOGO_SVG = `
    <svg class="brand-logo" width="38" height="38" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="KRONA VAULT Logo">
      <defs>
        <linearGradient id="vaultGoldGrad" x1="6" y1="4" x2="42" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#FBBF24" />
          <stop offset="50%" stop-color="#F59E0B" />
          <stop offset="100%" stop-color="#B45309" />
        </linearGradient>
        <linearGradient id="obsidianCore" x1="12" y1="10" x2="36" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#1A2234" />
          <stop offset="100%" stop-color="#07090E" />
        </linearGradient>
      </defs>
      <path d="M24 3L43 13.8V34.2L24 45L5 34.2V13.8L24 3Z" fill="url(#obsidianCore)" stroke="url(#vaultGoldGrad)" stroke-width="2.2" stroke-linejoin="round"/>
      <path d="M24 7.5L38.5 15.8V32.2L24 40.5L9.5 32.2V15.8L24 7.5Z" stroke="#F8FAFC" stroke-opacity="0.14" stroke-width="1"/>
      <rect x="15" y="17" width="6.5" height="14" rx="1.5" fill="url(#vaultGoldGrad)"/>
      <path d="M13.5 17H22.5" stroke="#FBBF24" stroke-width="1.8" stroke-linecap="round"/>
      <rect x="26.5" y="17" width="6.5" height="14" rx="1.5" fill="url(#vaultGoldGrad)"/>
      <path d="M25.5 17H34.5" stroke="#FBBF24" stroke-width="1.8" stroke-linecap="round"/>
      <line x1="24" y1="11" x2="24" y2="37" stroke="#F8FAFC" stroke-opacity="0.35" stroke-width="1.2" stroke-dasharray="2 2"/>
      <polygon points="24,19.5 28.5,24 24,28.5 19.5,24" fill="#10B981" stroke="#07090E" stroke-width="1.5"/>
    </svg>
  `;

  function getSessionToken() {
    return localStorage.getItem('krona_session_token') || '';
  }

  function setSessionToken(token) {
    if (token) {
      localStorage.setItem('krona_session_token', token);
    } else {
      localStorage.removeItem('krona_session_token');
    }
  }

  function getAuthHeaders() {
    const token = getSessionToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  function getSelectedStoreId() {
    const saved = sessionStorage.getItem('krona_store_id');
    if (latestState && latestState.stores && latestState.stores.length > 0) {
      if (saved) {
        const found = latestState.stores.find((s) => s.id === saved);
        if (found) return found.id;
      }
      const active = latestState.stores.find((s) => s.isActive);
      return active ? active.id : latestState.stores[0].id;
    }
    return saved || '';
  }

  function setSelectedStoreId(storeId) {
    if (storeId) {
      sessionStorage.setItem('krona_store_id', storeId);
    } else {
      sessionStorage.removeItem('krona_store_id');
    }
  }

  function populateStoreSelect(selectElementOrId, options = {}) {
    const el =
      typeof selectElementOrId === 'string'
        ? document.getElementById(selectElementOrId)
        : selectElementOrId;
    if (!el) return;
    const stores =
      (latestState && latestState.stores) || [];
    const {
      includeGlobal = false,
      globalLabel = 'GLOBAL (Todas las Sedes / Acceso Multitienda)',
      selectedId = getSelectedStoreId(),
      filterActiveOnly = false,
    } = options;
    const filtered = filterActiveOnly ? stores.filter((s) => s.isActive) : stores;
    const items = filtered.map(
      (s) =>
        `<option value="${s.id}" ${s.id === selectedId ? 'selected' : ''}>${s.name} (${s.code})${!s.isActive ? ' [Inactiva]' : ''}</option>`
    );
    if (includeGlobal) {
      items.unshift(`<option value="" ${!selectedId ? 'selected' : ''}>${globalLabel}</option>`);
    }
    el.innerHTML =
      items.length > 0
        ? items.join('')
        : '<option value="">(Sin Sedes Registradas)</option>';
  }

  function getSelectedPlayerId() {
    return sessionStorage.getItem('krona_player_id') || '';
  }

  function setSelectedPlayerId(playerId) {
    if (playerId) {
      sessionStorage.setItem('krona_player_id', playerId);
    } else {
      sessionStorage.removeItem('krona_player_id');
    }
  }

  function fmt(cents) {
    const val = Number(cents || 0) / 100;
    return '$' + val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' MXN';
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function toast(msg, isError = false) {
    let el = document.getElementById('krona-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'krona-toast';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      document.body.appendChild(el);
    }
    const cleanMsg = String(msg || '').replace(/^[✅❌🔒🔓🔐⚙️⚠️🏆✨💎📄🖨️🧾🔍➕🔗💾🔄]+\s*/u, '');
    el.style.borderColor = isError ? 'var(--status-crimson)' : 'var(--accent-emerald)';
    el.style.color = isError ? '#FCA5A5' : 'var(--text-primary)';
    el.innerHTML = `<span style="display:inline-flex;align-items:center;gap:0.55rem;">${isError ? icon('alert') : icon('check')} <span>${cleanMsg}</span></span>`;
    el.style.display = 'block';
    clearTimeout(el._timer);
    el._timer = setTimeout(() => {
      el.style.display = 'none';
    }, 4500);
  }

  async function quickSwitchRole(userId, targetPortal) {
    try {
      const res = await post('/api/auth/demo-switch', { userId });
      setSessionToken(res.token);
      toast(`Sesión iniciada como ${res.user.fullName} [${res.user.role}]`);
      const destination =
        targetPortal ||
        (res.capabilities && res.capabilities.defaultHomePortal) ||
        '/';
      if (window.location.pathname !== destination) {
        window.location.href = destination;
        return;
      }
      await refreshState();
    } catch (err) {
      toast(err.message, true);
    }
  }

  async function logoutSession() {
    try {
      const token = getSessionToken();
      if (token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: getAuthHeaders(),
        }).catch(() => {});
      }
    } finally {
      setSessionToken('');
      sessionStorage.removeItem('krona_store_id');
      sessionStorage.removeItem('krona_player_id');
      if (window.location.pathname !== '/login') {
        window.location.replace('/login');
      } else {
        toast('Sesión cerrada y revocada en el servidor');
        await refreshState();
      }
    }
  }

  function hasPermission(permissionCode) {
    if (!latestState || !latestState.authenticated || !latestState.sessionCapabilities) {
      return false;
    }
    const perms = latestState.sessionCapabilities.permissions || [];
    return perms.includes(permissionCode);
  }

  function showAccessDeniedModal(details = {}) {
    let modal = document.getElementById('kronaAccessDeniedModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'kronaAccessDeniedModal';
      modal.className = 'krona-modal-backdrop';
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      modal.setAttribute('aria-labelledby', 'kronaAccessDeniedTitle');
      document.body.appendChild(modal);
    }
    const portalName = details.portalName || details.fromRoute || 'este módulo';
    const role = details.role || (latestState && latestState.sessionUser && latestState.sessionUser.role) || 'NO_AUTH';
    const userName = details.userName ? ` (${details.userName})` : '';

    modal.innerHTML = `
      <div class="modal" style="max-width:500px;border-color:var(--status-crimson-border);background:var(--bg-abyss);box-shadow:0 20px 40px rgba(0,0,0,0.65);">
        <div class="modal-header" style="border-bottom:1px solid var(--border-subtle);display:flex;align-items:center;gap:0.75rem;padding-bottom:0.85rem;">
          <div style="color:var(--status-crimson);display:flex;align-items:center;">
            ${icon('alert')}
          </div>
          <div>
            <h3 id="kronaAccessDeniedTitle" style="margin:0;font-size:1.1rem;color:#FCA5A5;">Acceso Restringido por Política RBAC</h3>
            <span class="mono" style="font-size:0.74rem;color:var(--text-muted);">IAM SECURITY GUARD · 403 FORBIDDEN</span>
          </div>
        </div>
        <div class="modal-body" style="padding:1.15rem 0;font-size:0.88rem;color:var(--text-secondary);line-height:1.55;">
          <p style="margin-bottom:0.75rem;">
            El módulo <strong style="color:var(--text-primary);">${portalName}</strong> no está autorizado para tu cuenta con rol <span class="badge badge-crimson">${role}</span>${userName}.
          </p>
          <div style="background:var(--bg-slate);border:1px solid var(--border-default);border-radius:var(--radius-sm);padding:0.75rem;font-size:0.78rem;color:var(--text-secondary);margin-bottom:0.75rem;">
            🛡️ <strong>Principio de Menor Privilegio (RBAC):</strong> Cada rol del ecosistema KRONA VAULT™ cuenta con portales delimitados para garantizar la integridad contable y la trazabilidad forense.
          </div>
          <p style="margin:0;font-size:0.82rem;color:var(--text-muted);">
            Si requieres operar en este portal, solicita a un Administrador que actualice tus permisos o inicia sesión con un rol autorizado desde /login.
          </p>
        </div>
        <div class="modal-footer" style="display:flex;justify-content:flex-end;gap:0.5rem;border-top:1px solid var(--border-subtle);padding-top:0.85rem;">
          <button type="button" class="btn btn-gold" onclick="document.getElementById('kronaAccessDeniedModal').style.display='none'">
            Entendido
          </button>
        </div>
      </div>
    `;
    modal.style.display = 'flex';
  }

  function mountShellHeader(activeRoute) {
    currentActiveRoute = activeRoute;
    const target = document.getElementById('krona-header-root');
    if (!target) return;

    const routes = SYSTEM_PORTAL_ROUTES;

    const navHtml = routes
      .map(
        (r) => `
        <a href="${r.path}" data-route="${r.path}" class="krona-nav-item" style="display:none;" ${r.path === activeRoute ? 'aria-current="page"' : ''}>
          ${icon(r.iconName)}
          <span>${r.label}</span>
          <span class="krona-nav-tag">${r.tag}</span>
        </a>
      `
      )
      .join('');

    target.innerHTML = `
      <header class="krona-shell-header">
        <div class="krona-topbar">
          <div class="krona-brand-row">
            <a href="/login" id="kronaBrandHomeLink" class="krona-brand-link">
              ${LOGO_SVG}
              <div>
                <div class="krona-brand-title">
                  KRONA VAULT™ <span class="krona-brand-badge">IAM + LEDGER</span>
                </div>
                <span class="krona-brand-sub">KRONA VAULT™ · Cada Jugada, Auditada y Respaldada</span>
              </div>
            </a>

            <button type="button" id="kronaMobileMenuBtn" class="krona-mobile-toggle" aria-expanded="false" aria-controls="kronaHeaderCollapsible" aria-label="Alternar menú de navegación">
              ${icon('menu')} <span>Menú</span>
            </button>
          </div>

          <div id="kronaHeaderCollapsible" class="krona-header-collapsible">
            <nav id="kronaPortalNav" class="krona-portal-nav" aria-label="Portales Autorizados del Rol" style="display:none;">
              ${navHtml}
            </nav>

            <div class="krona-context-bar">
              <div id="contextStorePill" class="context-pill" style="display:none;">
                <label for="globalStoreSelect">Sede</label>
                <select id="globalStoreSelect" aria-label="Sucursal Activa"></select>
              </div>
              <div id="contextPlayerPill" class="context-pill" style="display:none;">
                <label for="globalPlayerSelect">Jugador</label>
                <select id="globalPlayerSelect" aria-label="Jugador Activo"></select>
              </div>
              <div id="globalSessionBadge" class="integrity-pill" style="border-color:var(--border-gold);color:var(--accent-gold-hover);">
                ${icon('lock')} <span>Sin sesión activa</span>
              </div>
              <button type="button" id="headerLogoutBtn" class="btn btn-crimson" style="display:none;" onclick="KronaCore.logoutSession()">
                ${icon('logout')} <span>Cerrar Sesión</span>
              </button>
            </div>
          </div>
        </div>
        <div id="krona-offline-banner">
          ⚠️ MODO SÓTANO ACTIVO: Sin conexión a internet. Mostrando saldos y PINs en caché local inmutable.
        </div>
        <div id="rbacGuardBanner" style="display:none;background:var(--status-crimson-soft);border-top:1px solid var(--status-crimson-border);padding:0.6rem 1.5rem;font-size:0.82rem;color:#FCA5A5;text-align:center;"></div>
      </header>
    `;

    const mobileBtn = document.getElementById('kronaMobileMenuBtn');
    const collapsible = document.getElementById('kronaHeaderCollapsible');
    if (mobileBtn && collapsible) {
      mobileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = collapsible.classList.toggle('is-open');
        mobileBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      });

      document.addEventListener('click', (e) => {
        if (!collapsible.contains(e.target) && !mobileBtn.contains(e.target)) {
          collapsible.classList.remove('is-open');
          mobileBtn.setAttribute('aria-expanded', 'false');
        }
      });

      collapsible.querySelectorAll('.krona-nav-item').forEach((item) => {
        item.addEventListener('click', () => {
          collapsible.classList.remove('is-open');
          mobileBtn.setAttribute('aria-expanded', 'false');
        });
      });
    }

    const storeSel = document.getElementById('globalStoreSelect');
    if (storeSel) {
      storeSel.addEventListener('change', (e) => {
        setSelectedStoreId(e.target.value);
        if (onStateChangeCallback && latestState) onStateChangeCallback(latestState);
      });
    }

    const playerSel = document.getElementById('globalPlayerSelect');
    if (playerSel) {
      playerSel.addEventListener('change', (e) => {
        setSelectedPlayerId(e.target.value);
        refreshState();
      });
    }
  }

  function applyDomRbacDirectives(allowedPortals, isReadOnlyAuditor) {
    // Ocultar enlaces o botones que apunten a portales no autorizados para el rol actual
    document.querySelectorAll('[data-require-portal]').forEach((el) => {
      const targetPortal = el.getAttribute('data-require-portal');
      if (targetPortal && !allowedPortals.includes(targetPortal)) {
        el.style.display = 'none';
      } else {
        el.style.display = '';
      }
    });

    // Deshabilitar controles mutantes cuando la sesión es AUDITOR (Solo Lectura)
    document.querySelectorAll('[data-require-permission]').forEach((el) => {
      const perm = el.getAttribute('data-require-permission');
      if (perm && !hasPermission(perm)) {
        el.setAttribute('disabled', 'disabled');
        el.title = `Permiso requerido: ${perm}`;
      } else {
        el.removeAttribute('disabled');
        el.title = '';
      }
    });

    if (isReadOnlyAuditor) {
      document.querySelectorAll('main button[onclick]').forEach((btn) => {
        const fn = btn.getAttribute('onclick') || '';
        const isSafeReadOnly =
          fn.includes('verifyPaperVoucher') ||
          fn.includes('autofillLastVoucherForVerify') ||
          fn.includes('printClosureReport') ||
          fn.includes('applyForensicFilters');
        if (!isSafeReadOnly && currentActiveRoute === '/audit') {
          btn.setAttribute('disabled', 'disabled');
          btn.title = 'Modo Auditor Fiscal (Solo Lectura): Operación de escritura deshabilitada';
        }
      });
    }
  }

  function syncHeaderControls(data) {
    const sessionBadge = document.getElementById('globalSessionBadge');
    const storePill = document.getElementById('contextStorePill');
    const playerPill = document.getElementById('contextPlayerPill');
    const brandHomeLink = document.getElementById('kronaBrandHomeLink');
    const portalNav = document.getElementById('kronaPortalNav');
    const headerLogoutBtn = document.getElementById('headerLogoutBtn');
    const banner = document.getElementById('rbacGuardBanner');

    // Si no hay sesión autenticada: purgar cualquier token huérfano, ocultar barra y redirigir a /login
    if (!data || data.authenticated === false || !data.sessionUser) {
      if (getSessionToken()) {
        setSessionToken('');
      }
      if (portalNav) portalNav.style.display = 'none';
      document.querySelectorAll('.krona-nav-item[data-route]').forEach((el) => {
        el.style.display = 'none';
      });
      if (storePill) storePill.style.display = 'none';
      if (playerPill) playerPill.style.display = 'none';
      if (headerLogoutBtn) headerLogoutBtn.style.display = 'none';
      if (banner) banner.style.display = 'none';
      if (brandHomeLink) brandHomeLink.setAttribute('href', '/login');
      if (sessionBadge) {
        sessionBadge.className = 'integrity-pill';
        sessionBadge.style.borderColor = 'var(--border-gold)';
        sessionBadge.style.color = 'var(--accent-gold-hover)';
        sessionBadge.innerHTML = `${icon('lock')} <span>Acceso Restringido · Sin sesión</span>`;
      }
      if (currentActiveRoute !== '/login') {
        window.location.replace('/login');
      }
      return;
    }

    const su = data.sessionUser;
    const caps = data.sessionCapabilities || {};
    const allowed = caps.allowedPortals || ['/profile'];
    const homePortal = caps.defaultHomePortal || allowed[0] || '/profile';

    if (brandHomeLink) {
      brandHomeLink.setAttribute('href', homePortal);
    }
    if (portalNav) {
      portalNav.style.display = 'flex';
    }
    if (headerLogoutBtn) {
      headerLogoutBtn.style.display = 'inline-flex';
    }

    // Verificar si venimos redirigidos por intento de acceso denegado previo
    const pendingNotice = sessionStorage.getItem('krona_rbac_denied_notice');
    if (pendingNotice) {
      sessionStorage.removeItem('krona_rbac_denied_notice');
      try {
        const parsed = JSON.parse(pendingNotice);
        setTimeout(() => showAccessDeniedModal(parsed), 80);
      } catch (_) {}
    }

    // Si el usuario está en una ruta NO permitida para su rol, guardar aviso y redirigir inmediatamente a su portal base
    if (currentActiveRoute !== '/login' && !allowed.includes(currentActiveRoute)) {
      const routeObj = SYSTEM_PORTAL_ROUTES.find((r) => r.path === currentActiveRoute);
      const portalLabel = routeObj ? `${routeObj.label} (${currentActiveRoute})` : currentActiveRoute;
      sessionStorage.setItem(
        'krona_rbac_denied_notice',
        JSON.stringify({
          fromRoute: currentActiveRoute,
          portalName: portalLabel,
          role: su.role,
          userName: su.fullName,
        })
      );
      window.location.replace(homePortal);
      return;
    }

    // Mostrar ÚNICAMENTE los portales permitidos para el rol en sesión
    document.querySelectorAll('.krona-nav-item[data-route]').forEach((el) => {
      const r = el.getAttribute('data-route');
      if (r && allowed.includes(r)) {
        el.style.display = 'inline-flex';
      } else {
        el.style.display = 'none';
      }
    });

    applyDomRbacDirectives(allowed, Boolean(caps.isReadOnlyAuditor));

    // Mostrar u ocultar selectores de Sede y Jugador según el Rol
    const canSeeStoreSelector = su.role !== 'PLAYER';
    const canSeePlayerSelector =
      su.role === 'SUPER_ADMIN' ||
      su.role === 'STORE_ADMIN' ||
      su.role === 'CASHIER' ||
      su.role === 'TOURNAMENT_ORGANIZER';

    if (storePill) {
      storePill.style.display = canSeeStoreSelector ? 'flex' : 'none';
    }
    if (playerPill) {
      playerPill.style.display = canSeePlayerSelector ? 'flex' : 'none';
    }

    const storeSel = document.getElementById('globalStoreSelect');
    if (storeSel && data.stores && canSeeStoreSelector) {
      const currentStore = getSelectedStoreId();
      if (data.stores.length === 0) {
        storeSel.innerHTML = '<option value="">(Sin Sedes Registradas)</option>';
      } else {
        const hasCurrent = data.stores.some((s) => s.id === currentStore);
        const effectiveStoreId = hasCurrent ? currentStore : data.stores[0].id;
        if (!hasCurrent) {
          setSelectedStoreId(effectiveStoreId);
        }
        storeSel.innerHTML = data.stores
          .map(
            (s) =>
              `<option value="${s.id}" ${s.id === effectiveStoreId ? 'selected' : ''}>${s.name} (${s.code})</option>`
          )
          .join('');
      }
    }

    const playerSel = document.getElementById('globalPlayerSelect');
    if (playerSel && data.players && canSeePlayerSelector) {
      const currentPlayer = getSelectedPlayerId();
      if (data.players.length === 0) {
        playerSel.innerHTML = '<option value="">(Sin Jugadores Registrados)</option>';
      } else {
        const hasCurrent = data.players.some((p) => p.userId === currentPlayer);
        const effectiveId = hasCurrent ? currentPlayer : data.players[0].userId;
        if (!hasCurrent) {
          setSelectedPlayerId(effectiveId);
        }
        playerSel.innerHTML = data.players
          .map(
            (p) =>
              `<option value="${p.userId}" ${p.userId === effectiveId ? 'selected' : ''}>${p.fullName} (${p.memberCode})</option>`
          )
          .join('');
      }
    }

    if (sessionBadge) {
      const ok = data.integrity && data.integrity.ledgerBalanced && data.integrity.auditChainIntact;
      sessionBadge.className = ok ? 'integrity-pill' : 'integrity-pill error';
      sessionBadge.style.borderColor = '';
      sessionBadge.style.color = '';
      sessionBadge.innerHTML = `${icon('user')} <span>${su.fullName} (${su.memberCode}) · [${su.role}]</span>`;
    }

    if (banner) {
      if (caps.isReadOnlyAuditor) {
        banner.style.display = 'block';
        banner.style.background = 'var(--accent-gold-soft)';
        banner.style.borderColor = 'var(--border-gold)';
        banner.style.color = 'var(--accent-gold-hover)';
        banner.innerHTML = `
          <span style="display:inline-flex;align-items:center;gap:0.5rem;">
            ${icon('eye')}
            <span><strong>MODO AUDITOR FISCAL (SOLO LECTURA):</strong> Sesión activa como <strong>${su.fullName} (${su.memberCode})</strong>. Tienes acceso de inspección forense total; las operaciones de escritura están deshabilitadas.</span>
          </span>
        `;
      } else {
        banner.style.display = 'none';
      }
    }
  }

  async function refreshState() {
    const offlineBanner = document.getElementById('krona-offline-banner');
    try {
      const playerId = getSelectedPlayerId();
      const res = await fetch(
        '/api/state?requireAuth=1&playerId=' + encodeURIComponent(playerId),
        {
          headers: getAuthHeaders(),
          cache: 'no-store',
        }
      );
      const data = await res.json();
      latestState = data;
      try {
        localStorage.setItem('krona_last_known_state', JSON.stringify(data));
      } catch (_) {}
      if (offlineBanner) offlineBanner.style.display = 'none';
      syncHeaderControls(data);
      if (data.authenticated === false && currentActiveRoute !== '/login') {
        return data;
      }
      if (onStateChangeCallback) {
        onStateChangeCallback(data);
      }
      return data;
    } catch (err) {
      console.warn('Conexión perdida con el servidor KRONA. Activando contingencia offline (Modo Sótano):', err);
      if (offlineBanner) offlineBanner.style.display = 'block';
      try {
        const cachedStr = localStorage.getItem('krona_last_known_state');
        if (cachedStr) {
          const cachedData = JSON.parse(cachedStr);
          latestState = cachedData;
          syncHeaderControls(cachedData);
          if (onStateChangeCallback) {
            onStateChangeCallback(cachedData);
          }
          return cachedData;
        }
      } catch (_) {}
    }
  }

  async function get(url) {
    const res = await fetch(url, { headers: getAuthHeaders(), cache: 'no-store' });
    const data = await res.json();
    if (res.status === 401) {
      setSessionToken('');
      if (currentActiveRoute !== '/login') {
        window.location.replace('/login');
      }
    }
    if (!res.ok || data.ok === false) {
      throw new Error(data.error || 'Error en consulta');
    }
    return data;
  }

  async function post(url, payload) {
    const activeBtn =
      document.activeElement && document.activeElement.tagName === 'BUTTON'
        ? document.activeElement
        : null;
    let prevHtml = '';
    if (activeBtn && !activeBtn.classList.contains('is-loading')) {
      prevHtml = activeBtn.innerHTML;
      activeBtn.classList.add('is-loading');
      activeBtn.setAttribute('aria-busy', 'true');
      activeBtn.innerHTML = `<span class="btn-spinner" aria-hidden="true"></span> <span>Procesando...</span>`;
    }

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.status === 401 && url !== '/api/auth/login') {
        setSessionToken('');
        if (currentActiveRoute !== '/login') {
          window.location.replace('/login');
        }
      }
      if (!res.ok || data.ok === false) {
        throw new Error(data.error || 'Error en operación');
      }
      return data;
    } finally {
      if (activeBtn && prevHtml) {
        activeBtn.classList.remove('is-loading');
        activeBtn.removeAttribute('aria-busy');
        activeBtn.innerHTML = prevHtml;
      }
    }
  }

  function renderQrSvg(seedStr, memberCode) {
    const qrLib = (typeof window !== "undefined" && window.qrcode) || (typeof qrcode === "function" && qrcode);
    if (qrLib) {
      try {
        const qr = qrLib(0, "M");
        qr.addData(seedStr);
        qr.make();
        const rawSvg = qr.createSvgTag({ cellSize: 5, margin: 4, scalable: true });
        const styledSvg = rawSvg.replace(
          "<svg ",
          "<svg style=\"width:100%;max-width:200px;height:auto;display:block;margin:0 auto;\" "
        );
        return `
          <div style="background:#FFFFFF;padding:0.65rem;border-radius:12px;display:inline-block;box-shadow:0 4px 18px rgba(0,0,0,0.35);max-width:220px;width:100%;box-sizing:border-box;">
            ${styledSvg}
          </div>
          <div class="mono" style="font-size:0.76rem;font-weight:700;color:#07090E;margin-top:0.45rem;letter-spacing:0.04em;">
            KRONA Pulse™ · ${memberCode}
          </div>
        `;
      } catch (err) {
        console.warn("[KRONA Pulse] Error al generar código QR ISO 18004:", err);
      }
    }
    // Fallback minimal
    return `
      <div style="background:#FFFFFF;color:#000000;padding:1rem;border-radius:8px;font-family:monospace;font-size:0.75rem;">
        <div>KRONA Pulse™ · ${memberCode}</div>
        <div style="font-size:0.65rem;word-break:break-all;margin-top:0.3rem;">${seedStr}</div>
      </div>
    `;
  }

  const _modalTriggerMap = new WeakMap();

  function openModal(modalOrId, openerEl = document.activeElement) {
    const el = typeof modalOrId === 'string' ? document.getElementById(modalOrId) : modalOrId;
    if (!el) return;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    if (!el.getAttribute('aria-labelledby') && !el.getAttribute('aria-label')) {
      const heading = el.querySelector('h1, h2, h3, h4, .card-title, .modal-title');
      if (heading) {
        if (!heading.id) heading.id = 'modalLabel_' + Math.random().toString(36).slice(2, 9);
        el.setAttribute('aria-labelledby', heading.id);
      } else {
        el.setAttribute('aria-label', 'Ventana Modal');
      }
    }
    if (openerEl) _modalTriggerMap.set(el, openerEl);
    el.style.display = 'flex';

    setTimeout(() => {
      const focusable = el.querySelector('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
      if (focusable) focusable.focus();
    }, 40);
  }

  function closeModal(modalOrId) {
    const el = typeof modalOrId === 'string' ? document.getElementById(modalOrId) : modalOrId;
    if (!el) return;
    el.style.display = 'none';
    const opener = _modalTriggerMap.get(el);
    if (opener && typeof opener.focus === 'function') {
      opener.focus();
    }
  }

  function confirm(options = {}) {
    return new Promise((resolve) => {
      const {
        title = '¿Confirmar Operación?',
        message = '¿Estás seguro de que deseas proceder con esta acción?',
        details = '',
        confirmText = 'Confirmar',
        cancelText = 'Cancelar',
        danger = true,
      } = typeof options === 'string' ? { message: options } : (options || {});

      let modal = document.getElementById('kronaConfirmModal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'kronaConfirmModal';
        modal.className = 'krona-modal-backdrop';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', 'kronaConfirmModalTitle');
        document.body.appendChild(modal);
      }

      const activeEl = document.activeElement;

      modal.innerHTML = `
        <div class="modal" style="max-width:480px;border-color:${danger ? 'var(--status-crimson-border)' : 'var(--border-gold)'};background:var(--bg-abyss);box-shadow:0 24px 60px rgba(0,0,0,0.85);text-align:left;">
          <div class="modal-header" style="border-bottom:1px solid var(--border-subtle);display:flex;align-items:center;justify-content:space-between;padding-bottom:0.75rem;margin-bottom:0.85rem;">
            <div style="display:flex;align-items:center;gap:0.6rem;">
              <div style="color:${danger ? 'var(--status-crimson)' : 'var(--accent-gold)'};display:flex;align-items:center;">
                ${danger ? icon('alert') : icon('shield')}
              </div>
              <h3 id="kronaConfirmModalTitle" style="margin:0;font-size:1.05rem;color:${danger ? '#FCA5A5' : 'var(--text-primary)'};">
                ${title}
              </h3>
            </div>
            <button type="button" class="btn-close-modal" id="kronaConfirmCloseX" aria-label="Cerrar modal de confirmación">✕</button>
          </div>
          <div class="modal-body" style="font-size:0.86rem;color:var(--text-secondary);line-height:1.55;margin-bottom:1.15rem;">
            <p style="margin:0 0 0.5rem 0;">${message}</p>
            ${details ? `<div style="background:var(--bg-slate);border:1px solid var(--border-default);border-radius:var(--radius-sm);padding:0.65rem 0.85rem;font-size:0.78rem;color:var(--text-muted);">${details}</div>` : ''}
          </div>
          <div class="modal-actions" style="display:flex;gap:0.65rem;justify-content:flex-end;flex-wrap:wrap;">
            <button type="button" id="kronaConfirmBtnCancel" class="btn btn-slate" style="min-width:110px;">
              ${cancelText}
            </button>
            <button type="button" id="kronaConfirmBtnOk" class="btn ${danger ? 'btn-crimson' : 'btn-gold'}" style="min-width:140px;">
              ${confirmText}
            </button>
          </div>
        </div>
      `;

      modal.style.display = 'flex';

      function cleanup(result) {
        modal.style.display = 'none';
        modal.removeEventListener('click', onBackdrop);
        document.removeEventListener('keydown', onKey);
        if (activeEl && typeof activeEl.focus === 'function') {
          activeEl.focus();
        }
        resolve(result);
      }

      function onBackdrop(e) {
        if (e.target === modal) cleanup(false);
      }

      function onKey(e) {
        if (e.key === 'Escape') {
          e.stopPropagation();
          cleanup(false);
        } else if (e.key === 'Tab') {
          const focusable = modal.querySelectorAll('button:not([disabled]), [tabindex]:not([tabindex="-1"])');
          if (focusable.length === 0) return;
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }

      modal.addEventListener('click', onBackdrop);
      document.addEventListener('keydown', onKey);
      document.getElementById('kronaConfirmCloseX').onclick = () => cleanup(false);
      document.getElementById('kronaConfirmBtnCancel').onclick = () => cleanup(false);
      document.getElementById('kronaConfirmBtnOk').onclick = () => cleanup(true);

      const focusTarget = danger ? document.getElementById('kronaConfirmBtnCancel') : document.getElementById('kronaConfirmBtnOk');
      setTimeout(() => focusTarget && focusTarget.focus(), 50);
    });
  }

  function printThermalText(rawText, optionsOrTitle = 'KRONA VAULT™ — Voucher Térmico') {
    const opts = typeof optionsOrTitle === 'string' ? { title: optionsOrTitle } : (optionsOrTitle || {});
    const paperWidth = opts.paperWidth === '58mm' ? '58mm' : '80mm';
    const title = opts.title || `KRONA VAULT™ — Voucher Térmico (${paperWidth})`;
    const widthMm = paperWidth === '58mm' ? '48mm' : '72mm';
    const fontSize = paperWidth === '58mm' ? '8.5pt' : '9.5pt';
    const maxQrMm = paperWidth === '58mm' ? '28mm' : '34mm';

    const qrHtml = opts.qrSvg ? `<div class="thermal-qr-container" style="text-align:center;margin:2.5mm auto;">${opts.qrSvg}</div>` : '';
    const w = window.open('', '_blank', 'width=420,height=680,menubar=no,toolbar=no,location=no');
    if (!w) {
      window.print();
      return;
    }

    w.document.open();
    w.document.write(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8" />
        <title>${title}</title>
        <style>
          @page { size: ${paperWidth} auto; margin: 0; }
          html, body {
            margin: 0;
            padding: 0;
            background: #FFFFFF;
            color: #000000;
            width: 100%;
          }
          body {
            font-family: 'Fira Code', 'JetBrains Mono', 'Courier New', Courier, monospace;
            width: ${widthMm};
            max-width: ${widthMm};
            margin: 0 auto;
            padding: 2mm 1mm 4mm 1mm;
            font-size: ${fontSize};
            line-height: 1.25;
            font-weight: 600;
            white-space: pre-wrap;
            word-break: break-word;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .thermal-qr-container svg,
          .thermal-qr-container img,
          svg, img {
            max-width: ${maxQrMm} !important;
            max-height: ${maxQrMm} !important;
            width: ${maxQrMm} !important;
            height: auto !important;
            margin: 1.5mm auto !important;
            display: block !important;
            image-rendering: pixelated !important;
          }
        </style>
      </head>
      <body>${rawText.replace(/</g, '&lt;')}${qrHtml}</body>
      </html>
    `);
    w.document.close();

    setTimeout(() => {
      w.focus();
      w.print();
      w.onafterprint = () => {
        try { w.close(); } catch (_) {}
      };
    }, 250);
  }

  function registerKeyboardShortcuts() {
    // Backdrop click listener para cerrar modales al hacer clic afuera
    document.addEventListener('click', (e) => {
      if (e.target && e.target.classList && (e.target.classList.contains('krona-modal-backdrop') || e.target.id.endsWith('Modal') || e.target.id.startsWith('modal'))) {
        if (e.target.style.display !== 'none' && e.target.style.position === 'fixed') {
          const closeBtn = e.target.querySelector('.btn-close-modal, [onclick*="close"], [onclick*="Close"]');
          if (closeBtn) closeBtn.click();
          else e.target.style.display = 'none';
        }
      }
    });

    window.addEventListener('keydown', (e) => {
      // Focus Trap en cualquier modal activo
      if (e.key === 'Tab') {
        const openModal = document.querySelector('.krona-modal-backdrop[style*="display: flex"], [id$="Modal"][style*="display: flex"], [id^="modal"][style*="display: flex"]');
        if (openModal) {
          const focusables = openModal.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
          if (focusables.length > 0) {
            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first.focus();
            }
          }
        }
      }

      if (e.key === 'Escape') {
        document.querySelectorAll('.krona-modal-backdrop, .modal, [id$="Modal"], [id^="modal"]').forEach((m) => {
          if (m.style.display !== 'none' && m.style.display !== '') {
            const closeBtn = m.querySelector('.btn-close-modal, [onclick*="close"], [onclick*="Close"]');
            if (closeBtn) closeBtn.click();
            else m.style.display = 'none';
          }
        });
        const coll = document.getElementById('kronaHeaderCollapsible');
        const mBtn = document.getElementById('kronaMobileMenuBtn');
        if (coll && coll.classList.contains('is-open')) {
          coll.classList.remove('is-open');
          if (mBtn) mBtn.setAttribute('aria-expanded', 'false');
        }
      }

      if (!e.altKey) return;
      const map = {
        '0': '/',
        '1': '/wallet',
        '2': '/pos',
        '3': '/tournaments',
        '4': '/audit',
        '5': '/users',
        '6': '/profile',
        '7': '/stores',
        '8': '/trade-in',
        '9': '/custody',
        'c': '/custody',
        'C': '/custody',
      };
      const dest = map[e.key];
      if (!dest) return;
      if (dest === '/login') {
        e.preventDefault();
        window.location.href = '/login';
        return;
      }
      if (latestState && latestState.authenticated && latestState.sessionCapabilities) {
        const allowedPortals = latestState.sessionCapabilities.allowedPortals || [];
        if (allowedPortals.includes(dest)) {
          e.preventDefault();
          window.location.href = dest;
        } else {
          e.preventDefault();
          const targetObj = SYSTEM_PORTAL_ROUTES.find((r) => r.path === dest);
          showAccessDeniedModal({
            fromRoute: dest,
            portalName: targetObj ? `${targetObj.label} (${dest})` : dest,
            role: (latestState.sessionUser && latestState.sessionUser.role) || 'DESCONOCIDO',
            userName: latestState.sessionUser && latestState.sessionUser.fullName,
          });
        }
      }
    });

    // Interceptar clics en enlaces locales para validar RBAC antes de la navegación
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a[href]');
      if (!link) return;
      const href = link.getAttribute('href');
      if (!href || href.startsWith('http') || href.startsWith('#') || href.startsWith('javascript:')) return;
      const targetPath = href.split('?')[0];
      const knownRoute = SYSTEM_PORTAL_ROUTES.find((r) => r.path === targetPath);
      if (knownRoute && latestState && latestState.authenticated && latestState.sessionCapabilities) {
        const allowedPortals = latestState.sessionCapabilities.allowedPortals || [];
        if (targetPath !== '/login' && !allowedPortals.includes(targetPath)) {
          e.preventDefault();
          showAccessDeniedModal({
            fromRoute: targetPath,
            portalName: `${knownRoute.label} (${targetPath})`,
            role: (latestState.sessionUser && latestState.sessionUser.role) || 'DESCONOCIDO',
            userName: latestState.sessionUser && latestState.sessionUser.fullName,
          });
        }
      }
    });

    // Auto-selección inteligente de contenido al enfocar cualquier campo numérico o de importe
    let lastFocusedInput = null;
    document.addEventListener('focusin', (e) => {
      const el = e.target;
      if (
        el &&
        el.tagName === 'INPUT' &&
        (el.type === 'number' ||
          el.inputMode === 'numeric' ||
          el.inputMode === 'decimal' ||
          el.classList.contains('auto-select') ||
          /amount|pin|cents|total|credit|fee|points|price|val|threshold|mxn/i.test(el.id || '') ||
          /amount|pin|cents|total|credit/i.test(el.name || ''))
      ) {
        lastFocusedInput = el;
        setTimeout(() => {
          try {
            if (document.activeElement === el) el.select();
          } catch (_) {}
        }, 30);
      }
    });

    document.addEventListener('mouseup', (e) => {
      if (lastFocusedInput && e.target === lastFocusedInput) {
        setTimeout(() => {
          try {
            if (document.activeElement === lastFocusedInput) lastFocusedInput.select();
          } catch (_) {}
          lastFocusedInput = null;
        }, 15);
      }
    });
  }

  function initPage(activeRoute, renderFn, autoPollMs = 3000) {
    if (activeRoute !== '/login' && !getSessionToken()) {
      window.location.replace('/login');
      return;
    }
    onStateChangeCallback = renderFn;
    mountShellHeader(activeRoute);
    registerKeyboardShortcuts();
    refreshState();
    if (autoPollMs > 0) {
      setInterval(refreshState, autoPollMs);
    }
    window.addEventListener('online', () => {
      const offB = document.getElementById('krona-offline-banner');
      if (offB) offB.style.display = 'none';
      refreshState();
    });
    window.addEventListener('offline', () => {
      const offB = document.getElementById('krona-offline-banner');
      if (offB) offB.style.display = 'block';
    });
    if ('caches' in window) {
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys.filter((k) => k !== 'krona-vault-pwa-v11').map((k) => caches.delete(k))
          )
        )
        .catch(() => {});
    }
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => reg.update().catch(() => {}))
        .catch(() => {});
    }
  }

  return {
    LOGO_SVG,
    icon,
    initPage,
    refreshState,
    get,
    post,
    fmt,
    escapeHtml,
    toast,
    renderQrSvg,
    printThermalText,
    openModal,
    closeModal,
    confirm,
    getSessionToken,
    setSessionToken,
    hasPermission,
    quickSwitchRole,
    logoutSession,
    showAccessDeniedModal,
    getSelectedStoreId,
    setSelectedStoreId,
    populateStoreSelect,
    getSelectedPlayerId,
    setSelectedPlayerId,
    getState: () => latestState,
  };
})();
