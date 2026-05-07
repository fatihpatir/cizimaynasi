document.addEventListener('DOMContentLoaded', () => {
    const video = document.getElementById('camera-stream');
    const overlayImage = document.getElementById('overlay-image');
    const fileInput = document.getElementById('file-input');
    const opacitySlider = document.getElementById('opacity-slider');
    const sizeSlider = document.getElementById('size-slider');
    const contrastSlider = document.getElementById('contrast-slider');
    const tiltXSlider = document.getElementById('tilt-x-slider');
    const tiltYSlider = document.getElementById('tilt-y-slider');
    const lockBtn = document.getElementById('lock-btn');
    const installBtn = document.getElementById('install-btn');
    const flipBtn = document.getElementById('flip-btn');
    const torchBtn = document.getElementById('torch-btn');
    const bottomDock = document.querySelector('.bottom-dock');
    const rotateBtn = document.getElementById('rotate-btn');
    const infoTrigger = document.getElementById('info-trigger');
    const infoModal = document.getElementById('info-modal');
    const closeModal = document.getElementById('close-modal');

    let currentRotation = 0;
    let isFlipped = false;
    let isTorchOn = false;
    let videoTrack;
    let deferredPrompt;

    // --- PWA Yükleme Mantığı ---
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
        } else {
            alert("iOS (iPhone/iPad) için:\n1. Safari'de Paylaş butonuna dokunun.\n2. 'Ana Ekrana Ekle' seçeneğini seçin.");
        }
    });

    // --- Kamera Erişimi ---
    async function initCamera() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
                audio: false
            });
            video.srcObject = stream;
            videoTrack = stream.getVideoTracks()[0];
            
            // Kamera hazır, açılış ekranını kapat
            setTimeout(() => {
                const splash = document.getElementById('splash-screen');
                splash.style.opacity = '0';
                setTimeout(() => splash.style.display = 'none', 800);
            }, 1000);

            // Fener desteğini kontrol et
            const caps = videoTrack.getCapabilities();
            if (!caps.torch) {
                torchBtn.style.display = 'none';
            }
        } catch (err) {
            console.error("Kamera hatası:", err);
            torchBtn.style.display = 'none';
        }
    }

    // --- Fener Kontrolü ---
    torchBtn.addEventListener('click', async () => {
        if (!videoTrack) return;
        try {
            isTorchOn = !isTorchOn;
            await videoTrack.applyConstraints({
                advanced: [{ torch: isTorchOn }]
            });
            torchBtn.style.background = isTorchOn ? 'var(--apple-blue)' : 'var(--bg-blur)';
        } catch (err) {
            console.error("Fener kontrol edilemedi:", err);
        }
    });

    // --- Resim İşleme ---
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
        currentRotation = 0;
        isFlipped = false;
        tiltXSlider.value = 0;
        tiltYSlider.value = 0;
        sizeSlider.value = 1;
        updateImageTransform();
    }

    // --- Kontroller ---
    opacitySlider.addEventListener('input', (e) => overlayImage.style.opacity = e.target.value);
    sizeSlider.addEventListener('input', () => updateImageTransform());
    tiltXSlider.addEventListener('input', () => updateImageTransform());
    tiltYSlider.addEventListener('input', () => updateImageTransform());
    contrastSlider.addEventListener('input', (e) => overlayImage.style.filter = `contrast(${e.target.value}%)`);
    
    rotateBtn.addEventListener('click', () => {
        currentRotation = (currentRotation + 90) % 360;
        updateImageTransform();
    });

    flipBtn.addEventListener('click', () => {
        isFlipped = !isFlipped;
        updateImageTransform();
        flipBtn.style.background = isFlipped ? 'var(--apple-blue)' : 'var(--bg-blur)';
    });

    lockBtn.addEventListener('click', () => {
        bottomDock.classList.toggle('locked');
        lockBtn.innerHTML = bottomDock.classList.contains('locked') ? '🔒' : '🔓';
    });

    function updateImageTransform() {
        const scale = sizeSlider.value;
        const tx = tiltXSlider.value;
        const ty = tiltYSlider.value;
        const flip = isFlipped ? -1 : 1;
        
        // Transform sırası: Döndür -> Aynala -> Eğ -> Ölçekle
        overlayImage.style.transform = `
            rotateZ(${currentRotation}deg) 
            scaleX(${flip}) 
            rotateX(${tx}deg) 
            rotateY(${ty}deg) 
            scale(${scale})
        `;
    }

    // --- Bilgi Modalı ---
    const showHelp = () => {
        infoModal.style.display = 'flex';
    };

    infoTrigger.addEventListener('click', showHelp);
    closeModal.addEventListener('click', () => {
        infoModal.style.display = 'none';
        localStorage.setItem('helpShown', 'true'); // Bir daha otomatik gösterme
    });
    
    window.addEventListener('click', (e) => {
        if (e.target === infoModal) infoModal.style.display = 'none';
    });

    // İlk açılışta otomatik göster (Akıllı Hafıza)
    if (!localStorage.getItem('helpShown')) {
        setTimeout(showHelp, 1000); // Kamera açıldıktan kısa bir süre sonra
    }

    initCamera();
});
