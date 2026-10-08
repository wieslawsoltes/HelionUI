// Shared, bounded diagnostic renderer. This is not a second DOM/control tree.
// Glyph masks are generated on-device from the SAME retained font outlines.
struct HudFrame { viewport:vec4<f32>, counts:vec4<u32>, flags:vec4<u32>, screen:vec4<u32> }
const HUD_WIDTH:f32=420.0;
const HUD_HEIGHT:f32=338.0;
fn hudScale()->f32 {
 // Preserve readable proportions on phones; small canvases fit instead of clipping.
 return max(0.01,min(1.0,min((hudFrame.viewport.x-16.0)/HUD_WIDTH,(hudFrame.viewport.y-16.0)/HUD_HEIGHT)));
}
fn hudRatio()->f32 { return max(0.00001,hudFrame.viewport.z*hudScale()); }
fn hudOrigin()->vec2<f32> {
 let extent=vec2<f32>(HUD_WIDTH,HUD_HEIGHT)*hudScale();
 return vec2<f32>(max(8.0,hudFrame.viewport.x-extent.x-12.0),max(8.0,hudFrame.viewport.y-extent.y-74.0));
}
// Device-pixel rectangle, evaluated identically by compute and the final quad.
fn hudPanelRect()->vec4<u32> {
 let scale=hudScale(); let origin=hudOrigin(); let dpr=hudFrame.viewport.z;
 let margin=12.0*scale*dpr+2.0;
 let first=max(vec2<f32>(0.0),floor(origin*dpr-vec2<f32>(margin)));
 let last=min(vec2<f32>(hudFrame.screen.xy),ceil((origin+vec2<f32>(HUD_WIDTH,HUD_HEIGHT)*scale)*dpr+vec2<f32>(margin)));
 return vec4<u32>(vec2<u32>(first),vec2<u32>(max(vec2<f32>(0.0),last-first)));
}
