// ========================================
// FAVICON SCROLLER CLASS
// Handles scrolling text through the browser favicon
// ========================================

class FaviconScroller {
    constructor(options = {}) {
        this.scrollInterval = null;
        this.delayTimeout = null;
        this.originalFavicon = null;
        
        // Configuration
        this.charWidth = options.charWidth || 18;
        this.slideSteps = options.slideSteps || 12;
        this.intervalMs = options.intervalMs || 40;
        this.initialDelayMs = options.initialDelayMs || 500;
        this.padding = options.padding || ' • ';
        this.font = options.font || '24px "DotGothic16", monospace';
        this.bgColor = options.bgColor || '#000000';
        this.textColor = options.textColor || '#ffffff';
        
        // Pre-create reusable canvases
        this.renderCanvas = document.createElement('canvas');
        this.renderCanvas.width = this.charWidth * 2;
        this.renderCanvas.height = 32;
        this.renderCtx = this.renderCanvas.getContext('2d');
        
        this.faviconCanvas = document.createElement('canvas');
        this.faviconCanvas.width = 32;
        this.faviconCanvas.height = 32;
        this.faviconCtx = this.faviconCanvas.getContext('2d');
    }

    saveOriginalFavicon() {
        if (this.originalFavicon === null) {
            const link = document.querySelector("link[rel*='icon']");
            this.originalFavicon = link ? link.href : null;
        }
    }

    restore() {
        this.stop();
        
        if (this.originalFavicon) {
            const link = document.querySelector("link[rel*='icon']");
            if (link) {
                link.href = this.originalFavicon;
            }
        }
    }

    stop() {
        if (this.scrollInterval) {
            clearInterval(this.scrollInterval);
            this.scrollInterval = null;
        }
        if (this.delayTimeout) {
            clearTimeout(this.delayTimeout);
            this.delayTimeout = null;
        }
    }

    start(text) {
        this.stop();
        this.saveOriginalFavicon();

        const faviconText = text ? text.toUpperCase() : '?';
        
        // If only one character, just display it statically
        if (faviconText.length <= 1) {
            this.drawStatic(faviconText.charAt(0) || '?');
            return;
        }

        const paddedText = faviconText + this.padding;
        const fullText = paddedText + faviconText; // For seamless looping
        
        let charIndex = 0;
        let slideOffset = 0;
        const slideAmount = this.charWidth / this.slideSteps;

        // Draw initial state (first character centered)
        this.drawTwoChars(
            faviconText.charAt(0),
            faviconText.charAt(1) || this.padding.charAt(0),
            0
        );

        // Start scrolling after initial delay
        this.delayTimeout = setTimeout(() => {
            this.scrollInterval = setInterval(() => {
                const char1 = fullText.charAt(charIndex % paddedText.length);
                const char2 = fullText.charAt((charIndex + 1) % paddedText.length);
                
                this.drawTwoChars(char1, char2, slideOffset);
                
                slideOffset += slideAmount;
                
                // When we've slid a full character width, move to next character pair
                if (slideOffset >= this.charWidth) {
                    slideOffset = 0;
                    charIndex++;
                    if (charIndex >= paddedText.length) {
                        charIndex = 0;
                    }
                }
            }, this.intervalMs);
        }, this.initialDelayMs);
    }

    drawStatic(letter) {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');
        
        ctx.fillStyle = this.bgColor;
        ctx.fillRect(0, 0, 32, 32);
        ctx.fillStyle = this.textColor;
        ctx.font = this.font;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(letter, 16, 17);
        
        this.updateFaviconLink(canvas.toDataURL('image/png'));
    }

    drawTwoChars(char1, char2, offset) {
        // Clear and draw background
        this.renderCtx.fillStyle = this.bgColor;
        this.renderCtx.fillRect(0, 0, this.charWidth * 2, 32);
        
        // Draw two characters centered in their respective slots
        this.renderCtx.fillStyle = this.textColor;
        this.renderCtx.font = this.font;
        this.renderCtx.textAlign = 'center';
        this.renderCtx.textBaseline = 'middle';
        this.renderCtx.fillText(char1, this.charWidth / 2, 17);
        this.renderCtx.fillText(char2, this.charWidth + this.charWidth / 2, 17);
        
        // Calculate the source x to keep the view centered
        const sourceX = (this.charWidth / 2 - 16) + offset;
        
        // Copy a 32x32 window from the render canvas
        this.faviconCtx.fillStyle = this.bgColor;
        this.faviconCtx.fillRect(0, 0, 32, 32);
        this.faviconCtx.drawImage(this.renderCanvas, sourceX, 0, 32, 32, 0, 0, 32, 32);
        
        this.updateFaviconLink(this.faviconCanvas.toDataURL('image/png'));
    }

    updateFaviconLink(dataUrl) {
        let link = document.querySelector("link[rel*='icon']");
        if (!link) {
            link = document.createElement('link');
            link.rel = 'icon';
            document.head.appendChild(link);
        }
        link.type = 'image/png';
        link.href = dataUrl;
    }
}
