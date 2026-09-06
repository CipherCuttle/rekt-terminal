import{j as u,r as x}from"./index-BwsSoFom.js";import{z as T,C as k,u as j,a as q}from"./index-CReJ0siU.js";import{C as w,b as z}from"./three.module-B54seRxb.js";const I=`
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`,R=`
precision highp float;

uniform float u_time;
uniform vec2 u_resolution;
uniform float u_speed;
uniform int u_colorLayers;
uniform float u_gridFrequency;
uniform float u_gridIntensity;
uniform float u_waveSpeed;
uniform float u_waveIntensity;
uniform float u_spiralIntensity;
uniform float u_lineThickness;
uniform float u_falloff;
uniform float u_centerX;
uniform float u_centerY;
uniform vec3 u_colorTint;
uniform vec3 u_backgroundColor;
uniform float u_brightness;
uniform float u_phaseOffset;

varying vec2 vUv;

void main() {
  float animTime = u_time * u_speed;
  vec2 resolution = u_resolution;

  vec3 colorAccum = vec3(0.0);
  float dist = 0.0;
  float depth = animTime;

  for (int layer = 0; layer < 3; layer++) {
    if (layer >= u_colorLayers) break;

    vec2 normalizedPos = vUv;
    vec2 centeredPos = vUv;
    centeredPos.x *= resolution.x / resolution.y;
    centeredPos -= vec2(u_centerX, u_centerY);

    depth += 0.05;
    dist = length(centeredPos);

    float horizontalWave = sin(centeredPos.x * u_gridFrequency + depth);
    float verticalWave = cos(centeredPos.y * u_gridFrequency + depth + u_phaseOffset);
    float gridPattern = u_gridIntensity * horizontalWave * verticalWave;

    float oscillation = sin(depth) + 1.0;
    float radialPulse = abs(sin(dist * 7.0 - depth * u_waveSpeed));
    float waveDisplacement = oscillation * radialPulse * u_waveIntensity;

    normalizedPos += (centeredPos / max(dist, 0.001)) * waveDisplacement * gridPattern;
    normalizedPos = fract(normalizedPos);

    float polarAngle = atan(centeredPos.y, centeredPos.x);
    float polarRadius = dist * 2.0;
    vec2 spiralOffset = vec2(
      cos(polarAngle * polarRadius - depth),
      sin(polarAngle * polarRadius - depth)
    ) * gridPattern * u_spiralIntensity;
    normalizedPos += spiralOffset;

    vec2 gridCell = fract(normalizedPos) - 0.5;
    float intensity = u_lineThickness / length(gridCell);

    if (layer == 0) colorAccum.r = intensity;
    else if (layer == 1) colorAccum.g = intensity;
    else colorAccum.b = intensity;
  }

  colorAccum = colorAccum / (dist + u_falloff);

  colorAccum *= u_brightness;
  vec3 tintedColor = colorAccum * u_colorTint;

  float alpha = clamp(length(colorAccum) * 0.5, 0.0, 1.0);
  vec3 finalColor = mix(u_backgroundColor, tintedColor, alpha);

  gl_FragColor = vec4(finalColor, 1.0);
}
`,F=({speed:o,colorLayers:t,gridFrequency:n,gridIntensity:a,waveSpeed:i,waveIntensity:l,spiralIntensity:s,lineThickness:c,falloff:f,centerX:m,centerY:v,colorTint:d,backgroundColor:_,brightness:p,phaseOffset:h})=>{const g=x.useRef(null),e=x.useRef(null),{viewport:r}=j(),y=x.useMemo(()=>({u_time:{value:0},u_resolution:{value:new z(r.width*100,r.height*100)},u_speed:{value:o},u_colorLayers:{value:t},u_gridFrequency:{value:n},u_gridIntensity:{value:a},u_waveSpeed:{value:i},u_waveIntensity:{value:l},u_spiralIntensity:{value:s},u_lineThickness:{value:c},u_falloff:{value:f},u_centerX:{value:m},u_centerY:{value:v},u_colorTint:{value:new w(d)},u_backgroundColor:{value:new w(_)},u_brightness:{value:p},u_phaseOffset:{value:h}}),[]);return q(P=>{e.current&&(e.current.uniforms.u_time.value=P.clock.elapsedTime,e.current.uniforms.u_resolution.value.set(r.width*100,r.height*100),e.current.uniforms.u_speed.value=o,e.current.uniforms.u_colorLayers.value=t,e.current.uniforms.u_gridFrequency.value=n,e.current.uniforms.u_gridIntensity.value=a,e.current.uniforms.u_waveSpeed.value=i,e.current.uniforms.u_waveIntensity.value=l,e.current.uniforms.u_spiralIntensity.value=s,e.current.uniforms.u_lineThickness.value=c,e.current.uniforms.u_falloff.value=f,e.current.uniforms.u_centerX.value=m,e.current.uniforms.u_centerY.value=v,e.current.uniforms.u_colorTint.value.set(d),e.current.uniforms.u_backgroundColor.value.set(_),e.current.uniforms.u_brightness.value=p,e.current.uniforms.u_phaseOffset.value=h)}),u.jsxs("mesh",{ref:g,scale:[r.width,r.height,1],children:[u.jsx("planeGeometry",{args:[1,1]}),u.jsx("shaderMaterial",{ref:e,vertexShader:I,fragmentShader:R,uniforms:y})]})},O=({width:o="100%",height:t="100%",className:n,speed:a=.3,colorLayers:i=3,gridFrequency:l=25,gridIntensity:s=1,waveSpeed:c=.2,waveIntensity:f=.1,spiralIntensity:m=1,lineThickness:v=.06,falloff:d=1,centerX:_=1,centerY:p=1,colorTint:h="#c084fc",lightBackground:g="#ffffff",darkBackground:e="#000000",brightness:r=1.5,phaseOffset:y=10})=>{const{resolvedTheme:P}=T(),C=P==="dark"?e:g,b=typeof o=="number"?`${o}px`:o,A=typeof t=="number"?`${t}px`:t,S=n?`squircle-shift-container ${n}`:"squircle-shift-container";return u.jsx("div",{className:S,style:{width:b,height:A},children:u.jsx(k,{className:"squircle-shift-canvas",gl:{antialias:!0,alpha:!1},camera:{position:[0,0,1],fov:75},children:u.jsx(F,{speed:a,colorLayers:i,gridFrequency:l,gridIntensity:s,waveSpeed:c,waveIntensity:f,spiralIntensity:m,lineThickness:v,falloff:d,centerX:_,centerY:p,colorTint:h,backgroundColor:C,brightness:r,phaseOffset:y})})})};O.displayName="SquircleShift";export{O as default};
