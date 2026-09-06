import{j as u,r as w}from"./index-DQM9WW-C.js";import{z as k,C as S,u as j,a as A}from"./index-Cgnwsd4e.js";import{C,b as I}from"./three.module-B54seRxb.js";const W=`
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`,M=`
precision highp float;

uniform float u_time;
uniform vec2 u_resolution;
uniform float u_speed;
uniform float u_waveCount;
uniform float u_waveAmplitude;
uniform float u_waveFrequency;
uniform float u_lineThickness;
uniform float u_grainIntensity;
uniform vec3 u_startColor;
uniform vec3 u_endColor;
uniform vec3 u_backgroundColor;
uniform float u_brightness;
uniform float u_speedVariation;
uniform float u_waveWidth;
uniform float u_scale;

varying vec2 vUv;

float generateNoise(vec2 position) {
  vec2 seed = vec2(12.9898, 78.233);
  float dotProduct = dot(position, seed);
  return fract(sin(dotProduct) * 43758.5453);
}

float applyGrain(vec2 position) {
  return (generateNoise(position) * 2.0 - 1.0) / 256.0;
}

vec4 calculateWaveLine(vec2 coord, float animSpeed, float horizontalScale, vec3 color) {
  float waveOffset = sin(u_time * animSpeed + coord.x * horizontalScale * u_waveFrequency) * u_waveAmplitude;
  float edgeFalloff = smoothstep(1.0, 0.0, abs(coord.x));
  coord.y += waveOffset * edgeFalloff;

  float lineIntensity = smoothstep(u_lineThickness, 0.0, abs(coord.y));

  float yFade = smoothstep(1.0, 0.2, abs(coord.y));
  float xFade = smoothstep(1.0, 0.3, abs(coord.x));
  float combinedFade = yFade * xFade;

  return vec4(color * lineIntensity * combinedFade, 1.0);
}

void main() {
  vec2 coord = vUv * 2.0 - 1.0;
  coord.x *= u_resolution.x / u_resolution.y;

  coord /= u_scale;

  coord.x /= u_waveWidth;

  vec4 colorAccumulator = vec4(0.0);

  for (float i = 0.0; i <= 50.0; i += 1.0) {
    if (i >= u_waveCount) break;

    float progress = i / u_waveCount * 2.0;

    float lineSpeed = u_speed + progress * u_speedVariation;

    float colorMix = i / u_waveCount;
    vec3 waveColor = mix(u_startColor, u_endColor, colorMix);

    colorAccumulator += calculateWaveLine(coord, lineSpeed, progress, waveColor);
  }

  vec3 waveColor = colorAccumulator.rgb * u_brightness;

  float waveIntensity = clamp(length(waveColor), 0.0, 1.0);
  float grain = applyGrain(coord) * u_grainIntensity * waveIntensity;
  waveColor += vec3(grain);

  float bgLuminance = dot(u_backgroundColor, vec3(0.299, 0.587, 0.114));
  vec3 finalColor;
  if (bgLuminance > 0.5) {
    float waveAlpha = clamp(length(waveColor), 0.0, 1.0);
    finalColor = mix(u_backgroundColor, waveColor, waveAlpha);
  } else {
    finalColor = u_backgroundColor + waveColor;
  }

  gl_FragColor = vec4(finalColor, 1.0);
}
`,T=({speed:a,waveCount:r,waveAmplitude:n,waveFrequency:t,lineThickness:l,grainIntensity:i,startColor:s,endColor:c,backgroundColor:v,brightness:f,speedVariation:m,waveWidth:d,scale:_})=>{const p=w.useRef(null),e=w.useRef(null),{viewport:o}=j(),h=w.useMemo(()=>({u_time:{value:0},u_resolution:{value:new I(o.width*100,o.height*100)},u_speed:{value:a},u_waveCount:{value:r},u_waveAmplitude:{value:n},u_waveFrequency:{value:t},u_lineThickness:{value:l},u_grainIntensity:{value:i},u_startColor:{value:new C(s)},u_endColor:{value:new C(c)},u_backgroundColor:{value:new C(v)},u_brightness:{value:f},u_speedVariation:{value:m},u_waveWidth:{value:d},u_scale:{value:_}}),[]);return A(g=>{e.current&&(e.current.uniforms.u_time.value=g.clock.elapsedTime,e.current.uniforms.u_resolution.value.set(o.width*100,o.height*100),e.current.uniforms.u_speed.value=a,e.current.uniforms.u_waveCount.value=r,e.current.uniforms.u_waveAmplitude.value=n,e.current.uniforms.u_waveFrequency.value=t,e.current.uniforms.u_lineThickness.value=l,e.current.uniforms.u_grainIntensity.value=i,e.current.uniforms.u_startColor.value.set(s),e.current.uniforms.u_endColor.value.set(c),e.current.uniforms.u_backgroundColor.value.set(v),e.current.uniforms.u_brightness.value=f,e.current.uniforms.u_speedVariation.value=m,e.current.uniforms.u_waveWidth.value=d,e.current.uniforms.u_scale.value=_)}),u.jsxs("mesh",{ref:p,scale:[o.width,o.height,1],children:[u.jsx("planeGeometry",{args:[1,1]}),u.jsx("shaderMaterial",{ref:e,vertexShader:W,fragmentShader:M,uniforms:h})]})},G=({width:a="100%",height:r="100%",className:n,speed:t=.5,waveCount:l=25,waveAmplitude:i=.85,waveFrequency:s=4,lineThickness:c=.2,grainIntensity:v=50,startColor:f="#ff6666",endColor:m="#6666ff",lightBackground:d="#ffffff",darkBackground:_="#000000",brightness:p=1,speedVariation:e=.006,waveWidth:o=3.5,scale:h=.6})=>{const{resolvedTheme:g}=k(),x=g==="dark"?_:d,y=typeof a=="number"?`${a}px`:a,b=typeof r=="number"?`${r}px`:r,F=n?`grain-wave-container ${n}`:"grain-wave-container";return u.jsx("div",{className:F,style:{width:y,height:b},children:u.jsx(S,{className:"grain-wave-canvas",gl:{antialias:!0,alpha:!1},camera:{position:[0,0,1],fov:75},children:u.jsx(T,{speed:t,waveCount:l,waveAmplitude:i,waveFrequency:s,lineThickness:c,grainIntensity:v,startColor:f,endColor:m,backgroundColor:x,brightness:p,speedVariation:e,waveWidth:o,scale:h})})})};G.displayName="GrainWave";export{G as default};
