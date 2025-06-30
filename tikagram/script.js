const backendUrl = 'https://tikagram-backend.onrender.com'; // URL вашего backend

document.getElementById('download-btn').addEventListener('click', async () => {
    const videoUrl = document.getElementById('video-url').value;
    const statusMessage = document.getElementById('status-message');
    const resultContainer = document.getElementById('resultContainer');

    // Очистка предыдущих результатов
    resultContainer.innerHTML = '';

    if (!videoUrl) {
        statusMessage.textContent = 'Пожалуйста, введите ссылку.';
        return;
    }

    try {
        const response = await fetch(`${backendUrl}/download`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url: videoUrl }),
        });

        if (response.ok) {
            const data = await response.json();
            if (data.downloadLink) {
                const videoPreview = document.createElement('video');
                videoPreview.src = data.downloadLink;
                videoPreview.controls = true;
                videoPreview.style.width = '100%';
                resultContainer.appendChild(videoPreview);
            } else {
                statusMessage.textContent = 'Видео не найдено.';
            }
        } else {
            const error = await response.json();
            statusMessage.textContent = error.message || 'Ошибка при скачивании видео.';
        }
    } catch (error) {
        statusMessage.textContent = 'Ошибка соединения с сервером.';
    }
});

document.getElementById('video-url').addEventListener('input', async (event) => {
    const videoUrl = event.target.value.trim();
    const statusMessage = document.getElementById('status-message');
    const resultContainer = document.getElementById('resultContainer');

    if (!videoUrl) {
        resultContainer.innerHTML = '';
        statusMessage.textContent = '';
        return;
    }

    try {
        const response = await fetch(`${backendUrl}/download`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url: videoUrl }),
        });

        if (response.ok) {
            const data = await response.json();
            if (data.downloadLink) {
                const videoPreview = document.createElement('video');
                videoPreview.src = data.downloadLink;
                videoPreview.controls = true;
                videoPreview.style.width = '100%';
                resultContainer.innerHTML = '';
                resultContainer.appendChild(videoPreview);
            } else {
                statusMessage.textContent = 'Видео не найдено.';
            }
        } else {
            const error = await response.json();
            statusMessage.textContent = error.message || 'Ошибка при скачивании видео.';
        }
    } catch (error) {
        statusMessage.textContent = 'Ошибка соединения с сервером.';
    }
});
