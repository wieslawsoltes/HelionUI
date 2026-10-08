/** Serializable retained animation descriptors. Interpolation runs in compute. */
export const Easing = Object.freeze({Linear:'linear',Smooth:'smooth',CubicIn:'cubicIn',CubicOut:'cubicOut',CubicInOut:'cubicInOut',SineInOut:'sineInOut',BackOut:'backOut',Spring:'spring',Step:'step'});
export function KeyFrame(cue,value,easing='linear') {return {cue,value,easing};}
export class ScalarKeyFrameAnimation {
 constructor(options={}) {this.duration=1;this.delay=0;this.iterations=1;this.direction='normal';this.fillMode='forwards';this.keyFrames=[];Object.assign(this,options);}
 insertKeyFrame(cue,value,easing='linear') {this.keyFrames.push(KeyFrame(cue,value,easing));return this;}
 InsertKeyFrame(cue,value,easing='linear') {return this.insertKeyFrame(cue,value,easing);}
 toAnimation(property) {return {property,duration:this.duration,delay:this.delay,iterations:this.iterations,direction:this.direction,fillMode:this.fillMode,keyFrames:this.keyFrames.map(k=>({...k}))};}
}
export class Vector2KeyFrameAnimation extends ScalarKeyFrameAnimation {
 toAnimations(property) {
  const pair=({Offset:['translateX','translateY'],Scale:['scaleX','scaleY'],offset:['translateX','translateY'],scale:['scaleX','scaleY']})[property];
  if(!pair) throw new TypeError('Vector2 animation targets Offset or Scale');
  return pair.map((p,i)=>({...super.toAnimation(p),keyFrames:this.keyFrames.map(k=>({...k,value:k.value[i]}))}));
 }
}
export class CompositionAnimationGroup {
 constructor(...animations) {this.animations=animations.flat();}
 add(animation) {this.animations.push(animation);return this;}
 toAnimations() {return this.animations.flatMap(a=>a instanceof CompositionAnimationGroup?a.toAnimations():a);}
}
export class Compositor {
 createScalarKeyFrameAnimation(options) {return new ScalarKeyFrameAnimation(options);}
 createVector2KeyFrameAnimation(options) {return new Vector2KeyFrameAnimation(options);}
 createAnimationGroup(...animations) {return new CompositionAnimationGroup(...animations);}
 CreateScalarKeyFrameAnimation(options) {return this.createScalarKeyFrameAnimation(options);}
 CreateVector2KeyFrameAnimation(options) {return this.createVector2KeyFrameAnimation(options);}
 CreateAnimationGroup(...animations) {return this.createAnimationGroup(...animations);}
}
export function bindExpression(property,source,{scale=1,offset=0,min=-1e7,max=1e7}={}) {
 return {property,expression:{source,scale,offset,min,max}};
}
export function transition(property,duration=.18,easing='smooth') {return {property,duration,easing};}
