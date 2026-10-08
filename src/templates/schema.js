/** Template wire records. Addresses and offsets are 32-bit words. */
export const TEMPLATE_MAGIC=0x48545031;
export const TEMPLATE_INFO_WORDS=20;
export const TEMPLATE_PLAN_WORDS=24;
export const TEMPLATE_RULE_WORDS=16;
export const TEMPLATE_VALUE_WORDS=8;
export const TemplateCommand=Object.freeze({theme:0,state:1,automatic:2,reducedMotion:3,clearLocalValue:4,accent:5,resetAccent:6,contrast:7,density:8});
// category: 0 packed color; 1 float; 2 boolean; 3 uint; 4 string alias.
export const templateProperties=Object.freeze({
 background:[0,20],foreground:[0,21],borderColor:[0,22],radius:[1,23],borderWidth:[1,35],
 width:[1,8],height:[1,9],minWidth:[1,10],minHeight:[1,11],maxWidth:[1,12],maxHeight:[1,13],
 padding:[1,14],gap:[1,15],fontSize:[1,34],x:[1,32],y:[1,33],
 opacity:[1,75],translateX:[1,80],translateY:[1,81],scaleX:[1,82],scaleY:[1,83],rotation:[1,84],value:[1,72],
 disabled:[2,16],hidden:[2,32],wrap:[2,4],horizontalAlignment:[3,24],verticalAlignment:[3,25],
 text:[4,6],actualWidth:[1,54],actualHeight:[1,55]
});
export const templateLayoutProperties=new Set(['width','height','minWidth','minHeight','maxWidth','maxHeight','padding','gap','fontSize','x','y','hidden','wrap','horizontalAlignment','verticalAlignment','text']);
export const templateReadableStates=Object.freeze({isPointerOver:1,isPressed:2,isFocused:4,isChecked:8,isEnabled:16,isVisible:256});
