$('#path').on('keyup', function ($event) {
    $('#ctrlPath').text($('#path').val());
});
$('#reset').click(function ($event) {
    $('#path').val(null);
    $('#code').val(null);
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
            },
            error: function (err) {
                $('#message').text(JSON.stringify(err.responseJSON));
            }
        });
    }
});