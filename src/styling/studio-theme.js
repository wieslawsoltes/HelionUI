/** Shared visual tokens for Helion's first-party workspaces. */
export const STUDIO=Object.freeze({
 base:'#111114',panel:'#19191f',inset:'#151519',raised:'#202027',line:'#303038',
 text:'#eeeef2',muted:'#a0a0ad',subtle:'#777786',accent:'#b9a7ff',
 primary:'#b9a7ff',onPrimary:'#211936',selected:'#302a42',hover:'#292832'
});
export function studioButtons(name){return `
 Button.${name} { Background: ${STUDIO.raised}; Foreground: ${STUDIO.text}; CornerRadius: 6; FontSize: 11; }
 Button.${name}:pointerover { Background: ${STUDIO.hover}; }
 Button.${name}:pressed { Background: #383143; }
 Button.${name}:focus { BorderBrush: ${STUDIO.accent}; BorderThickness: 1; }
 Button.primary { Background: ${STUDIO.primary}; Foreground: ${STUDIO.onPrimary}; }
 Button.primary:pointerover { Background: #c9bcff; }
`;}
