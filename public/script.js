document.addEventListener('DOMContentLoaded', function() {
    const sendPhishingButton = document.getElementById('sendPhishing');

    sendPhishingButton.addEventListener('click', function() {
        fetch('/send-phishing', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email: 'user@example.com' })
        })
        .then(response => response.text())
        .then(data => alert(data))
        .catch(error => console.error('Ошибка:', error));
    });
});