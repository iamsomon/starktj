const backendUrl = 'https://tikagram-backend.onrender.com'; // URL вашего backend

document.getElementById('download-btn').addEventListener('click', async () => {
    const videoUrl = document.getElementById('video-url').value;
    const statusMessage = document.getElementById('status-message');

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
            window.location.href = data.downloadLink;
        } else {
            const error = await response.json();
            statusMessage.textContent = error.message || 'Ошибка при скачивании видео.';
        }
    } catch (error) {
        statusMessage.textContent = 'Ошибка соединения с сервером.';
    }
});
