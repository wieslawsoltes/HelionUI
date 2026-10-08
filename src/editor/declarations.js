/** Serializable initial asset; live document state is owned by GPU buffers. */
export function TextDocument(text='',options={}) { return { ...options, text:String(text) }; }
