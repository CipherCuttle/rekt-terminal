import{r as n,j as H}from"./index-BwsSoFom.js";import{W as oe,S as ae,O as re,a as ne,V as b,b as ie,P as le,M as se}from"./three.module-B54seRxb.js";const de=({width:c="100%",height:u="100%",speed:f=1,intensity:d=1,scale:m=6,downScale:v=.5,primaryColor:O="#5227FF",secondaryColor:S="#5227FF",tertiaryColor:F="#0a0a0a",opacity:p=1,quality:I="medium",maxFPS:E=60,pauseWhenOffscreen:h=!0,className:$="",children:T})=>{const y=n.useRef(null),l=n.useRef(0),g=n.useRef(0),x=n.useRef(0),V=n.useRef(!0);n.useEffect(()=>{if(!y.current)return;const r=y.current,w=t=>{const o=/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(t);return o?{r:parseInt(o[1],16)/255,g:parseInt(o[2],16)/255,b:parseInt(o[3],16)/255}:{r:0,g:0,b:0}},R=w(O),C=w(S),B=w(F),A=r.getBoundingClientRect(),_=A.width,L=A.height,P={low:{pixelRatio:1,antialias:!1},medium:{pixelRatio:Math.min(window.devicePixelRatio,2),antialias:!0},high:{pixelRatio:Math.min(window.devicePixelRatio,3),antialias:!0}}[I],e=new oe({antialias:P.antialias,alpha:!0,powerPreference:"high-performance",stencil:!1,depth:!1});e.setClearColor(0,0);const i=P.pixelRatio;e.setSize(_,L,!1),e.setPixelRatio(i),e.domElement.style.width="100%",e.domElement.style.height="100%",e.domElement.style.display="block",r.appendChild(e.domElement);const D=new ae,J=new re(-1,1,1,-1,0,1),K=_*i,Q=L*i,a={iTime:{value:0},iResolution:{value:new ie(K,Q)},uSpeed:{value:f},uIntensity:{value:d},uScale:{value:m},uDownScale:{value:v},uOpacity:{value:p},uColor1:{value:new b(R.r,R.g,R.b)},uColor2:{value:new b(C.r,C.g,C.b)},uColor3:{value:new b(B.r,B.g,B.b)}},X=`
      void main() {
        gl_Position = vec4(position, 1.0);
      }
    `,Y=`
      #define COLOR_COUNT 3

      uniform float iTime;
      uniform vec2 iResolution;
      uniform float uSpeed;
      uniform float uIntensity;
      uniform float uScale;
      uniform float uDownScale;
      uniform float uOpacity;

      uniform vec3 uColor1;
      uniform vec3 uColor2;
      uniform vec3 uColor3;

      vec3 colors[COLOR_COUNT];

      void setupColorPalette() {
        colors[0] = uColor1;
        colors[1] = uColor2;
        colors[2] = uColor3;
      }

      float Bayer2(vec2 a) {
        a = floor(a);
        return fract(a.x / 2.0 + a.y * a.y * 0.75);
      }

      #define Bayer4(a)   (Bayer2(0.5 * (a)) * 0.25 + Bayer2(a))
      #define Bayer8(a)   (Bayer4(0.5 * (a)) * 0.25 + Bayer2(a))
      #define Bayer16(a)  (Bayer8(0.5 * (a)) * 0.25 + Bayer2(a))
      #define Bayer32(a)  (Bayer16(0.5 * (a)) * 0.25 + Bayer2(a))
      #define Bayer64(a)  (Bayer32(0.5 * (a)) * 0.25 + Bayer2(a))

      vec3 applyDitheredColor(float value, vec2 pixelCoord) {
        float paletteIndex = clamp(value, 0.0, 1.0) * float(COLOR_COUNT - 1);

        vec3 colorA = vec3(0.0);
        vec3 colorB = vec3(0.0);

        for (int i = 0; i < COLOR_COUNT; i++) {
          if (float(i) == floor(paletteIndex)) {
            colorA = colors[i];
            if (i < COLOR_COUNT - 1) {
              colorB = colors[i + 1];
            } else {
              colorB = colorA;
            }
            break;
          }
        }

        float ditherValue = Bayer64(pixelCoord * 0.25);

        float blendAmount = float(fract(paletteIndex) > ditherValue);

        return mix(colorA, colorB, blendAmount);
      }

      float flowField(vec2 p, float t) {
        return sin(p.x + sin(p.y + t * 0.1)) * sin(p.y * p.x * 0.1 + t * 0.2);
      }

      vec2 computeField(vec2 p, float t) {
        vec2 ep = vec2(0.05, 0.0);
        vec2 result = vec2(0.0);

        for (int i = 0; i < 20; i++) {
          float t0 = flowField(p, t);
          float t1 = flowField(p + ep.xy, t);
          float t2 = flowField(p + ep.yx, t);
          vec2 gradient = vec2((t1 - t0), (t2 - t0)) / ep.xx;
          vec2 tangent = vec2(-gradient.y, gradient.x);

          p += tangent * 0.5 + gradient * 0.005;
          p.x += sin(t * 0.25) * 0.1;
          p.y += cos(t * 0.25) * 0.1;
          result = gradient;
        }

        return result;
      }

      void main() {
        setupColorPalette();

        vec2 uv = gl_FragCoord.xy / iResolution.xy - 0.5;
        uv.x *= iResolution.x / iResolution.y;
        float animTime = iTime * uSpeed;

        vec2 p = uv * uScale;

        vec2 field = computeField(p, animTime);

        float colorValue = length(field) * uIntensity;
        colorValue = clamp(colorValue, 0.0, 1.0);

        vec3 finalColor = applyDitheredColor(colorValue, gl_FragCoord.xy / uDownScale);

        gl_FragColor = vec4(finalColor, uOpacity);
      }
    `,N=new ne({uniforms:a,vertexShader:X,fragmentShader:Y,transparent:!0}),z=new le(2,2),Z=new se(z,N);D.add(Z);let s=null;h&&(s=new IntersectionObserver(t=>{V.current=t[0].isIntersecting},{threshold:0}),s.observe(r));const M=1e3/E,U=t=>{l.current=requestAnimationFrame(U),g.current||(g.current=t,x.current=t);const o=t-x.current;o<M||(x.current=t-o%M,!(h&&!V.current)&&(a.iTime.value=(t-g.current)*.001,a.uSpeed.value=f,a.uIntensity.value=d,a.uScale.value=m,a.uDownScale.value=v,a.uOpacity.value=p,e.render(D,J)))};l.current=requestAnimationFrame(U);const W=()=>{const t=r.getBoundingClientRect(),o=t.width,j=t.height;e.setSize(o,j,!1);const ee=o*i,te=j*i;a.iResolution.value.set(ee,te)};return window.addEventListener("resize",W),()=>{window.removeEventListener("resize",W),l.current&&cancelAnimationFrame(l.current),s&&s.disconnect(),z.dispose(),N.dispose(),e.dispose(),r.contains(e.domElement)&&r.removeChild(e.domElement)}},[f,d,m,v,O,S,F,p,I,E,h]);const q=typeof c=="number"?`${c}px`:c,k=typeof u=="number"?`${u}px`:u,G=`dither-wave-container ${$}`.trim();return H.jsx("div",{ref:y,className:G,style:{width:q,height:k},children:T&&H.jsx("div",{className:"dither-wave-children",children:T})})};export{de as default};
