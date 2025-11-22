import React, { useEffect } from 'react';
import { useEditor, EditorContent, ReactRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Mention from '@tiptap/extension-mention';
import tippy from 'tippy.js';
import 'tippy.js/dist/tippy.css';
import { Bold, Italic, Code, List, ListOrdered } from 'lucide-react';
import { MentionList } from './MentionList';
import api from '../../lib/api';

interface RichTextEditorProps {
    value: string;
    onChange: (content: string, mentionedUserIds: string[]) => void;
    onEnter?: () => void;
    placeholder?: string;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({ value, onChange, onEnter }) => {
    const editor = useEditor({
        extensions: [
            StarterKit,
            Mention.configure({
                HTMLAttributes: {
                    class: 'mention',
                },
                suggestion: {
                    items: async ({ query }) => {
                        try {
                            const res = await api.get('/users/agents');
                            const users = res.data.filter((u: any) =>
                                u.fullName.toLowerCase().includes(query.toLowerCase())
                            ).slice(0, 5);
                            return users.map((u: any) => ({
                                id: u.id,
                                label: u.fullName,
                            }));
                        } catch (e) {
                            return [];
                        }
                    },
                    render: () => {
                        let component: ReactRenderer;
                        let popup: any;

                        return {
                            onStart: (props) => {
                                component = new ReactRenderer(MentionList, {
                                    props,
                                    editor: props.editor,
                                });

                                if (!props.clientRect) {
                                    return;
                                }

                                popup = tippy('body', {
                                    getReferenceClientRect: props.clientRect as any,
                                    appendTo: () => document.body,
                                    content: component.element,
                                    showOnCreate: true,
                                    interactive: true,
                                    trigger: 'manual',
                                    placement: 'bottom-start',
                                });
                            },
                            onUpdate(props) {
                                component.updateProps(props);

                                if (!props.clientRect) {
                                    return;
                                }

                                popup[0].setProps({
                                    getReferenceClientRect: props.clientRect,
                                });
                            },
                            onKeyDown(props) {
                                if (props.event.key === 'Escape') {
                                    popup[0].hide();
                                    return true;
                                }
                                return (component.ref as any)?.onKeyDown(props);
                            },
                            onExit() {
                                popup[0].destroy();
                                component.destroy();
                            },
                        };
                    },
                },
            }),
        ],
        content: value,
        editorProps: {
            attributes: {
                class: 'prose prose-invert max-w-none focus:outline-none min-h-[60px] text-sm text-white',
            },
            handleKeyDown: (_view, event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    onEnter?.();
                    return true;
                }
                return false;
            },
        },
        onUpdate: ({ editor }) => {
            const json = editor.getJSON();
            const mentionedUserIds: string[] = [];

            // Traverse JSON to find mentions
            const findMentions = (node: any) => {
                if (node.type === 'mention' && node.attrs?.id) {
                    mentionedUserIds.push(node.attrs.id);
                }
                if (node.content) {
                    node.content.forEach(findMentions);
                }
            };

            if (json.content) {
                json.content.forEach(findMentions);
            }

            onChange(editor.getHTML(), [...new Set(mentionedUserIds)]);
        },
    });

    useEffect(() => {
        if (editor && value !== editor.getHTML()) {
            // Only update if content is different to avoid cursor jumps
            // But for chat input reset, we need to clear it
            if (value === '') {
                editor.commands.clearContent();
            }
        }
    }, [value, editor]);

    if (!editor) {
        return null;
    }

    return (
        <div className="flex flex-col border border-white/10 rounded-lg bg-slate-900 overflow-hidden">
            <div className="flex items-center gap-1 p-2 border-b border-white/10 bg-navy-main/50">
                <button
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    className={`p-1.5 rounded hover:bg-white/10 ${editor.isActive('bold') ? 'bg-white/20 text-neon-green' : 'text-slate-400'}`}
                    title="Bold"
                >
                    <Bold className="w-4 h-4" />
                </button>
                <button
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    className={`p-1.5 rounded hover:bg-white/10 ${editor.isActive('italic') ? 'bg-white/20 text-neon-green' : 'text-slate-400'}`}
                    title="Italic"
                >
                    <Italic className="w-4 h-4" />
                </button>
                <button
                    onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                    className={`p-1.5 rounded hover:bg-white/10 ${editor.isActive('codeBlock') ? 'bg-white/20 text-neon-green' : 'text-slate-400'}`}
                    title="Code Block"
                >
                    <Code className="w-4 h-4" />
                </button>
                <div className="w-px h-4 bg-white/10 mx-1" />
                <button
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    className={`p-1.5 rounded hover:bg-white/10 ${editor.isActive('bulletList') ? 'bg-white/20 text-neon-green' : 'text-slate-400'}`}
                    title="Bullet List"
                >
                    <List className="w-4 h-4" />
                </button>
                <button
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    className={`p-1.5 rounded hover:bg-white/10 ${editor.isActive('orderedList') ? 'bg-white/20 text-neon-green' : 'text-slate-400'}`}
                    title="Ordered List"
                >
                    <ListOrdered className="w-4 h-4" />
                </button>
            </div>
            <div className="p-3 max-h-[200px] overflow-y-auto">
                <EditorContent editor={editor} />
            </div>
        </div>
    );
};
