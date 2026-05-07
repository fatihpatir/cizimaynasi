document.addEventListener('DOMContentLoaded', () => {
    const video = document.getElementById('camera-stream');
    const overlayImage = document.getElementById('overlay-image');
    const overlayContainer = document.getElementById('overlay-container');
    const fileInput = document.getElementById('file-input');
    const opacitySlider = document.getElementById('opacity-slider');
    const sizeSlider = document.getElementById('size-slider');
    const contrastSlider = document.getElementById('contrast-slider');
    const tiltXSlider = document.getElementById('tilt-x-slider');
    const tiltYSlider = document.getElementById('tilt-y-slider');
    const dockToggle = document.getElementById('dock-toggle');
    const installBtn = document.getElementById('install-btn');
    const bottomDock = document.querySelector('.bottom-dock');
    const rotateBtn = document.getElementById('rotate-btn');
    const flipBtn = document.getElementById('flip-btn');
    const torchBtn = document.getElementById('torch-btn');
    const infoTrigger = document.getElementById('info-trigger');
    const infoModal = document.getElementById('info-modal');
    const closeModal = document.getElementById('close-modal');

    let currentRotation = 0;
    let isFlipped = false;
    let isTorchOn = false;
    let videoTrack;
    let deferredPrompt;

    // --- Dokunmatik Değişkenler ---
    let scale = 1;
    let posX = 0;
    let posY = 0;
    let initialDist = 0;
    let initialScale = 1;
    let isDragging = false;
    let startX, startY;

    // --- PWA Yükleme Mantığı (Android & iOS) ---
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

    if (!isStandalone) {
        if (isIOS) {
            // iOS için her zaman göster (Çünkü beforeinstallprompt desteklenmiyor)
            installBtn.style.display = 'block';
        }
    }

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        installBtn.style.display = 'block';
    });

    installBtn.addEventListener('click', async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') installBtn.style.display = 'none';
            deferredPrompt = null;
        } else if (isIOS) {
            alert("iPhone/iPad İçin Kurulum:\n\n1. Alt taraftaki 'Paylaş' (Kare içinde yukarı ok) butonuna dokunun.\n2. Listeyi aşağı kaydırıp 'Ana Ekrana Ekle' seçeneğini seçin.");
        }
    });

    // --- Kamera ---
    async function initCamera() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
                audio: false
            });
            video.srcObject = stream;
            videoTrack = stream.getVideoTracks()[0];
            
            setTimeout(() => {
                const splash = document.getElementById('splash-screen');
                if (splash) {
                    splash.style.opacity = '0';
                    setTimeout(() => splash.style.display = 'none', 800);
                }
            }, 1000);

            const caps = videoTrack.getCapabilities();
            if (!caps.torch) torchBtn.style.display = 'none';
        } catch (err) {
            console.error("Kamera hatası:", err);
            torchBtn.style.display = 'none';
        }
    }

    // --- Fener ---
    torchBtn.addEventListener('click', async () => {
        if (!videoTrack) return;
        try {
            isTorchOn = !isTorchOn;
            await videoTrack.applyConstraints({ advanced: [{ torch: isTorchOn }] });
            torchBtn.style.background = isTorchOn ? 'var(--apple-blue)' : 'var(--bg-blur)';
        } catch (err) { console.error(err); }
    });

    // --- Resim Seçme ---
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                overlayImage.src = event.target.result;
                overlayImage.style.display = 'block';
                resetImageState();
            };
            reader.readAsDataURL(file);
        }
    });

    function resetImageState() {
        currentRotation = 0; isFlipped = false; posX = 0; posY = 0; scale = 1;
        tiltXSlider.value = 0; tiltYSlider.value = 0; sizeSlider.value = 1;
        updateImageTransform();
    }

    // --- Dokunmatik Kontroller ---
    overlayContainer.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            isDragging = true;
            startX = e.touches[0].clientX - posX;
            startY = e.touches[0].clientY - posY;
        } else if (e.touches.length === 2) {
            isDragging = false;
            initialDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
            initialScale = scale;
        }
    });

    overlayContainer.addEventListener('touchmove', (e) => {
        if (isDragging && e.touches.length === 1) {
            posX = e.touches[0].clientX - startX;
            posY = e.touches[0].clientY - startY;
            updateImageTransform();
        } else if (e.touches.length === 2) {
            const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
            scale = Math.min(Math.max(initialScale * (dist / initialDist), 0.1), 3);
            sizeSlider.value = scale;
            updateImageTransform();
        }
    });

    overlayContainer.addEventListener('touchend', () => isDragging = false);

    // --- Slider & Buton Olayları ---
    opacitySlider.addEventListener('input', (e) => overlayImage.style.opacity = e.target.value);
    sizeSlider.addEventListener('input', (e) => { scale = parseFloat(e.target.value); updateImageTransform(); });
    tiltXSlider.addEventListener('input', () => updateImageTransform());
    tiltYSlider.addEventListener('input', () => updateImageTransform());
    contrastSlider.addEventListener('input', (e) => overlayImage.style.filter = `contrast(${e.target.value}%)`);
    
    rotateBtn.addEventListener('click', () => { currentRotation = (currentRotation + 90) % 360; updateImageTransform(); });
    flipBtn.addEventListener('click', () => {
        isFlipped = !isFlipped;
        updateImageTransform();
        flipBtn.style.background = isFlipped ? 'var(--apple-blue)' : 'var(--bg-blur)';
    });

    dockToggle.addEventListener('click', () => {
        bottomDock.classList.toggle('locked');
        dockToggle.innerHTML = bottomDock.classList.contains('locked') ? '▲' : '▼';
    });

    function updateImageTransform() {
        const tx = tiltXSlider.value;
        const ty = tiltYSlider.value;
        const flip = isFlipped ? -1 : 1;
        overlayImage.style.transform = `translate(${posX}px, ${posY}px) rotateZ(${currentRotation}deg) scaleX(${flip}) rotateX(${tx}deg) rotateY(${ty}deg) scale(${scale})`;
    }

    // --- Bilgi Modalı ---
    const showHelp = () => infoModal.style.display = 'flex';
    infoTrigger.addEventListener('click', showHelp);
    closeModal.addEventListener('click', () => {
        infoModal.style.display = 'none';
        localStorage.setItem('helpShown', 'true');
    });
    window.addEventListener('click', (e) => { if (e.target === infoModal) infoModal.style.display = 'none'; });

    if (!localStorage.getItem('helpShown')) setTimeout(showHelp, 1000);

    initCamera();
});
