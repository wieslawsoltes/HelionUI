// Startup-critical presentation. No diagnostic font or chart dependencies.
@group(0) @binding(1) var uiImage:texture_2d<f32>;
@group(0) @binding(2) var<uniform> hudFrame:HudFrame;
@group(0) @binding(0) var image:texture_2d<f32>;
@group(0) @binding(3) var<storage,read> surfaceState:array<u32>;
@vertex fn vertex(@builtin(vertex_index) index:u32)->@builtin(position) vec4<f32> {
 var positions=array<vec2<f32>,3>(vec2<f32>(-1.0,-1.0),vec2<f32>(3.0,-1.0),vec2<f32>(-1.0,3.0));
 return vec4<f32>(positions[index],0.0,1.0);
}
@fragment fn blitFragment(@builtin(position) position:vec4<f32>)->@location(0) vec4<f32> {
 let pixel=vec2<i32>(position.xy);
 if(surfaceState[15]!=0u && pixel.y<4) { return vec4<f32>(0.9,0.07,0.10,1.0); }
 return vec4<f32>(textureLoad(image,pixel,0).rgb,1.0);
}

// A GPU-positioned pixel-exact quad: no text/curve/AA work in either copy entry.
@vertex fn hudVertex(@builtin(vertex_index) index:u32)->@builtin(position) vec4<f32> {
 let uv=array<vec2<f32>,6>(vec2<f32>(0,0),vec2<f32>(1,0),vec2<f32>(0,1),vec2<f32>(0,1),vec2<f32>(1,0),vec2<f32>(1,1));
 let rect=hudPanelRect(); let point=vec2<f32>(rect.xy)+uv[index]*vec2<f32>(rect.zw);
 let ndc=point/vec2<f32>(hudFrame.screen.xy)*2.0-vec2<f32>(1.0);
 return vec4<f32>(ndc.x,-ndc.y,0.0,1.0);
}
@fragment fn hudBlitFragment(@builtin(position) position:vec4<f32>)->@location(0) vec4<f32> {
 let pixel=vec2<i32>(position.xy); let rect=hudPanelRect();
 return textureLoad(image,pixel-vec2<i32>(rect.xy),0);
}
// Same texels, fullscreen reference composition for pixel-comparison tests.
@fragment fn hudFullscreenFragment(@builtin(position) position:vec4<f32>)->@location(0) vec4<f32> {
 let pixel=vec2<u32>(position.xy); let rect=hudPanelRect();
 if(all(pixel>=rect.xy) && all(pixel<rect.xy+rect.zw)) { return textureLoad(image,vec2<i32>(pixel-rect.xy),0); }
 if(surfaceState[15]!=0u && pixel.y<4u) { return vec4<f32>(.9,.07,.10,1.0); }
 return vec4<f32>(textureLoad(uiImage,vec2<i32>(pixel),0).rgb,1.0);
}
