
import React from 'react';
import { RichBlock } from '../types';
import { Trash2, Type, Image as ImageIcon, FileText, Download, Paperclip } from 'lucide-react';
import { generateUUID } from '../services/mockBackend';

interface RichContentBlockProps {
    blocks: RichBlock[];
    onChange: (blocks: RichBlock[]) => void;
    readOnly?: boolean;
}

const RichContentBlock: React.FC<RichContentBlockProps> = ({ blocks, onChange, readOnly = false }) => {

    const addBlock = (type: 'text' | 'image' | 'file') => {
        const newBlock: RichBlock = {
            id: generateUUID(),
            type,
            content: ''
        };
        onChange([...blocks, newBlock]);
    };

    const updateBlock = (id: string, content: string, meta?: string) => {
        onChange(blocks.map(b => b.id === id ? { ...b, content, meta } : b));
    };

    const removeBlock = (id: string) => {
        onChange(blocks.filter(b => b.id !== id));
    };

    const handleFileUpload = (id: string, e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'file') => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (evt) => {
                if (evt.target?.result) {
                    updateBlock(id, evt.target.result as string, file.name);
                }
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <div className="space-y-4">
            {blocks.map((block, index) => (
                <div key={block.id} className="group relative flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {!readOnly && (
                        <div className="absolute -left-8 top-2 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1 z-10">
                            <button type="button" onClick={() => removeBlock(block.id)} className="text-red-400 hover:text-red-600 p-1 bg-white dark:bg-gray-800 rounded-lg shadow-sm"><Trash2 size={16}/></button>
                        </div>
                    )}

                    <div className="flex-1 min-w-0">
                        {block.type === 'text' ? (
                            <textarea
                                value={block.content}
                                onChange={e => updateBlock(block.id, e.target.value)}
                                disabled={readOnly}
                                placeholder="متن خود را اینجا بنویسید..."
                                className={`w-full bg-white dark:bg-gray-900/50 rounded-xl p-4 border border-transparent ${!readOnly ? 'focus:border-blue-200 dark:focus:border-blue-800 shadow-sm' : ''} outline-none resize-none min-h-[100px] text-gray-800 dark:text-gray-200 leading-relaxed transition-all`}
                            />
                        ) : block.type === 'image' ? (
                            <div className={`relative rounded-2xl overflow-hidden bg-gray-50 dark:bg-gray-900 border-2 border-dashed ${!block.content ? 'border-gray-300 dark:border-gray-700 h-40 flex items-center justify-center' : 'border-transparent'}`}>
                                {block.content ? (
                                    <img src={block.content} alt="Content" className="w-full h-auto max-h-[500px] object-contain" />
                                ) : (
                                    <div className="text-center text-gray-400 pointer-events-none">
                                        <ImageIcon className="mx-auto mb-2" size={32} />
                                        <span className="text-xs">تصویر را بارگذاری کنید</span>
                                    </div>
                                )}
                                {!readOnly && (
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                        onChange={(e) => handleFileUpload(block.id, e, 'image')}
                                    />
                                )}
                            </div>
                        ) : (
                            // FILE BLOCK
                            <div className={`relative rounded-2xl p-4 flex items-center gap-4 bg-gray-50 dark:bg-gray-900 border-2 border-dashed ${!block.content ? 'border-gray-300 dark:border-gray-700 justify-center h-24' : 'border-blue-200 dark:border-blue-900/30'}`}>
                                {block.content ? (
                                    <>
                                        <div className="bg-blue-100 dark:bg-blue-900/40 p-3 rounded-xl text-blue-600 dark:text-blue-400">
                                            <FileText size={24} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-sm text-gray-800 dark:text-gray-200 truncate">{block.meta || 'فایل ضمیمه'}</p>
                                            <a href={block.content} download={block.meta || 'attachment'} className="text-xs text-blue-500 hover:text-blue-600 font-bold flex items-center gap-1 mt-1">
                                                <Download size={12} /> دانلود فایل
                                            </a>
                                        </div>
                                    </>
                                ) : (
                                    <div className="text-center text-gray-400 pointer-events-none flex items-center gap-2">
                                        <Paperclip size={20} />
                                        <span className="text-xs font-bold">انتخاب فایل (PDF, ZIP, Doc...)</span>
                                    </div>
                                )}
                                {!readOnly && (
                                    <input
                                        type="file"
                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                        onChange={(e) => handleFileUpload(block.id, e, 'file')}
                                    />
                                )}
                            </div>
                        )}
                    </div>
                </div>
            ))}

            {!readOnly && (
                <div className="flex gap-2 justify-center py-4 border-t border-gray-100 dark:border-gray-800 mt-6 border-dashed">
                    <button type="button" onClick={() => addBlock('text')} className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors font-bold text-sm">
                        <Type size={16} />
                        متن
                    </button>
                    <button type="button" onClick={() => addBlock('image')} className="flex items-center gap-2 px-4 py-2 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-xl hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors font-bold text-sm">
                        <ImageIcon size={16} />
                        تصویر
                    </button>
                    <button type="button" onClick={() => addBlock('file')} className="flex items-center gap-2 px-4 py-2 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded-xl hover:bg-orange-100 dark:hover:bg-orange-900/40 transition-colors font-bold text-sm">
                        <Paperclip size={16} />
                        فایل
                    </button>
                </div>
            )}

            {readOnly && blocks.length === 0 && (
                <p className="text-center text-gray-400 text-sm py-8 italic">توضیحات تکمیلی ثبت نشده است.</p>
            )}
        </div>
    );
};

export default RichContentBlock;
