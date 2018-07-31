$('#path').on('keyup', function ($event) {
    $('#ctrlPath').text($('#path').val());
    const code = $('#code').text();
    const path = $('#path').val();
    if (code && code.trim() && path && path.trim()) {
        $('#deploy').removeAttr('disabled');
    } else {
        $('#deploy').attr('disabled', true);
    }
});
$('#code').on('keyup', function ($event) {
    const code = $event.target.innerText;
    const path = $('#path').val();
    if (code && code.trim() && path && path.trim()) {
        $('#deploy').removeAttr('disabled');
    } else {
        $('#deploy').attr('disabled', true);
    }
});
$('#deploy').click(function ($event) {
    const code = $('#code').text();
    const path = $('#path').val();
    if (code && code.trim() && path && path.trim()) {
        $.ajax({
            type: 'POST',
            url: '/deploy',
            data: {
                path: path,
                code: code
            },
            dataType: 'json',
            success: function (res) {
                $('#message').text(JSON.stringify(res));
                $('#console').removeClass('d-none');
                $('#console').attr('href', `/${path}/console`);
            },
            error: function (err) {
                $('#message').text(JSON.stringify(err.responseJSON));
            }
        });
    }
});