<template>
  <div class="message-input-container">
    <div class="input-actions">
      <button @click="toggleEmojiPicker" class="icon-btn" title="Emoji">😊</button>
      <button @click="triggerFileInput" class="icon-btn" title="Attach File">📎</button>
      <input
        ref="fileInput"
        type="file"
        style="display: none"
        @change="handleFileSelect"
        accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
      />
    </div>
    <div class="emoji-picker" v-if="showEmojiPicker">
      <div class="emoji-grid">
        <button
          v-for="emoji in commonEmojis"
          :key="emoji"
          @click="insertEmoji(emoji)"
          class="emoji-btn"
        >
          {{ emoji }}
        </button>
      </div>
    </div>
    <textarea
      v-model="messageText"
      @input="handleInput"
      @keydown.enter.exact.prevent="sendTextMessage"
      @keydown.enter.shift.exact="messageText += '\n'"
      placeholder="Type a message..."
      class="message-textarea"
      rows="1"
      ref="textareaRef"
    ></textarea>
    <button @click="sendTextMessage" :disabled="!canSend" class="send-btn">Send</button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { storageService } from '../services/storage';

const props = defineProps<{
  chatId: string;
}>();

const emit = defineEmits<{
  send: [data: { 
    content: string; 
    type: string; 
    file?: File; 
    replyToId?: string;
    fileUrl?: string;
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
  }];
  'typing-start': [];
  'typing-stop': [];
}>();

const messageText = ref('');
const showEmojiPicker = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);
const textareaRef = ref<HTMLTextAreaElement | null>(null);
const typingTimeout = ref<ReturnType<typeof setTimeout> | null>(null);

const commonEmojis = [
  '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣',
  '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰',
  '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜',
  '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏',
  '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣',
  '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠',
  '👍', '👎', '❤️', '🔥', '💯', '✅', '❌', '⭐',
];

const canSend = computed(() => messageText.value.trim().length > 0);

function toggleEmojiPicker() {
  showEmojiPicker.value = !showEmojiPicker.value;
}

function insertEmoji(emoji: string) {
  messageText.value += emoji;
  showEmojiPicker.value = false;
  if (textareaRef.value) {
    textareaRef.value.focus();
  }
}

function triggerFileInput() {
  fileInput.value?.click();
}

function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (file) {
    handleSend(file);
    target.value = '';
  }
}

let typingStartTimeout: ReturnType<typeof setTimeout> | null = null;
let isTyping = false;

function handleInput() {
  // Auto-resize textarea
  if (textareaRef.value) {
    textareaRef.value.style.height = 'auto';
    textareaRef.value.style.height = `${textareaRef.value.scrollHeight}px`;
  }

  // Debounce typing start - only emit after user stops typing for 300ms
  if (typingStartTimeout) {
    clearTimeout(typingStartTimeout);
  }

  // Start typing indicator if not already typing
  if (!isTyping) {
    isTyping = true;
    emit('typing-start');
  }

  // Clear existing stop timeout
  if (typingTimeout.value) {
    clearTimeout(typingTimeout.value);
  }

  // Stop typing after 2 seconds of inactivity
  typingTimeout.value = setTimeout(() => {
    if (isTyping) {
      isTyping = false;
      emit('typing-stop');
    }
  }, 2000);
}

function sendTextMessage() {
  handleSend();
}

async function handleSend(file?: File) {
  // Only allow sending if there's content or a file, and file must be a File instance
  if (!canSend.value && !(file instanceof File)) return;

  const content = messageText.value.trim();
  
  // If file is provided, upload it first
  if (file instanceof File) {
    try {
      const uploadedFile = await storageService.uploadFile(file, 'chat');
      const type = file.type.startsWith('image/') ? 'image' : file.type.startsWith('audio/') ? 'voice' : 'file';
      
      emit('send', {
        content: '',
        type,
        fileUrl: uploadedFile.fileUrl,
        fileName: uploadedFile.fileName,
        fileSize: uploadedFile.fileSize,
        mimeType: uploadedFile.mimeType,
      });
    } catch (error) {
      console.error('Failed to upload file:', error);
      return;
    }
  } else {
    // Text message
    emit('send', {
      content,
      type: 'text',
    });
  }

  messageText.value = '';
  showEmojiPicker.value = false;
  if (textareaRef.value) {
    textareaRef.value.style.height = 'auto';
  }
  
  // Clear typing timeouts and stop typing indicator
  if (typingStartTimeout) {
    clearTimeout(typingStartTimeout);
    typingStartTimeout = null;
  }
  if (typingTimeout.value) {
    clearTimeout(typingTimeout.value);
    typingTimeout.value = null;
  }
  if (isTyping) {
    isTyping = false;
    emit('typing-stop');
  }
}

watch(() => props.chatId, () => {
  messageText.value = '';
  showEmojiPicker.value = false;
  // Clear typing indicators when switching chats
  if (typingStartTimeout) {
    clearTimeout(typingStartTimeout);
    typingStartTimeout = null;
  }
  if (typingTimeout.value) {
    clearTimeout(typingTimeout.value);
    typingTimeout.value = null;
  }
  if (isTyping) {
    isTyping = false;
    emit('typing-stop');
  }
});
</script>

<style scoped>
.message-input-container {
  display: flex;
  flex-direction: column;
  padding: 1rem;
  border-top: 1px solid #e0e0e0;
  background: white;
  position: relative;
}

.input-actions {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.icon-btn {
  background: none;
  border: none;
  font-size: 1.25rem;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 4px;
  transition: background 0.2s;
}

.icon-btn:hover {
  background: #f0f0f0;
}

.emoji-picker {
  position: absolute;
  bottom: 100%;
  left: 1rem;
  right: 1rem;
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 0.5rem;
  margin-bottom: 0.5rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  z-index: 10;
  max-height: 200px;
  overflow-y: auto;
}

.emoji-grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 0.25rem;
}

.emoji-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 4px;
  transition: background 0.2s;
}

.emoji-btn:hover {
  background: #f0f0f0;
}

.message-textarea {
  flex: 1;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 0.75rem;
  font-size: 1rem;
  font-family: inherit;
  resize: none;
  max-height: 120px;
  overflow-y: auto;
}

.message-textarea:focus {
  outline: none;
  border-color: #667eea;
}

.send-btn {
  margin-top: 0.5rem;
  padding: 0.75rem 1.5rem;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
  align-self: flex-end;
}

.send-btn:hover:not(:disabled) {
  background: #5568d3;
}

.send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>

