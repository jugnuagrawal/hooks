(function () {
    'use strict';

    angular
        .module('hooks')
        .controller('hookController', hookController);

    hookController.$inject = ['$http'];
    function hookController($http) {
        var vm = this;
        var stack = [];
        vm.activate = () => {
            var path = localStorage.getItem('path');
            if (path) {
                vm.path = path;
                vm.loadHook();
            }
        };
        vm.init = () => {
            stack = [];
            vm.selectedTab = 0;
            vm.path = null;
            vm.loadedPath = null;
            vm.code = 'res.json(req.body)';
            vm.message = null;
            vm.logs = [];
            vm.runTime = null;
            vm.error = false;
            vm.disableStop = true;
            vm.autoRefresh = false;
            vm.toggleSidenav = false;
            vm.hookList = [];
            vm.toggleAutoRefresh(false);
        };
        vm.onBlur = ($event) => {
            vm.path = vm.camelCase(vm.path);
            if (vm.path !== vm.loadedPath) {
                vm.loadHook();
            }
        };
        vm.onKeyUp = ($event) => {
            if ($event.keyCode === 13) {
                if (vm.code.charAt(vm.code.length - 1) == '{') {
                    stack.push('{');
                }
                var temp = new Array(stack.length * 4);
                temp.fill(' ');
                vm.code += '\n' + temp.join('');
            }
        };
        vm.keypress = ($event) => {
            if ($event.keyCode === 125 && stack.length > 0) {
                if (stack.pop()) {
                    vm.code = vm.code.substr(0, vm.code.length - 4);
                }
            }
        };
        vm.camelCase = (string) => {
            if (string) {
                return string.split(' ').filter(e => e.trim()).map((e, i) => i === 0 ? e : e[0].toUpperCase() + e.substr(1, e.length)).join('');
            }
            return null;
        };
        vm.loadAllHooks = () => {
            $http({
                method: 'GET',
                url: `/hook`,
                responseType: 'json'
            }).then(res => {
                if (res.data) {
                    vm.hookList = res.data.hooks;
                }
            }).catch(err => {
                console.log('ERROR:', err);
            });
        };
        vm.loadHook = () => {
            var path = vm.camelCase(vm.path);
            vm.loadedPath = path;
            $http({
                method: 'GET',
                url: `/hook/${path}`,
                responseType: 'json'
            }).then(res => {
                if (res.data) {
                    vm.autoRefresh = false;
                    vm.toggleAutoRefresh(false);
                    vm.runTime = Math.floor((new Date() - new Date(res.data.timestamp)) / 1000);
                    var s = vm.runTime % 60;
                    var m = Math.floor(vm.runTime / 60) % 60;
                    var h = Math.floor(Math.floor(vm.runTime / 60) / 60);
                    vm.runTime = h + ' hr ' + m + ' min ' + s + ' sec';
                    vm.code = res.data.code;
                    var code = localStorage.getItem('code');
                    if (!vm.code && code) {
                        vm.code = code;
                    }
                    vm.disableStop = false;
                    vm.loadLogs();
                } else {
                    vm.init();
                    vm.path = path;
                }
            }).catch(err => {
                console.log('ERROR:', err);
            });
        };
        vm.createHook = () => {
            localStorage.setItem('path', vm.path);
            localStorage.setItem('code', vm.code);
            $http({
                method: 'POST',
                url: '/deploy',
                data: {
                    path: vm.path,
                    code: vm.code
                },
                responseType: 'json'
            }).then(res => {
                if (res.data) {
                    vm.message = res.data.message;
                    vm.disableStop = false;
                    if (res.status === 200) {
                        vm.error = false;
                    } else {
                        vm.error = true;
                    }
                }
            }).catch(err => {
                console.log('ERROR:', err);
            });
        };
        vm.deleteHook = () => {
            var path = vm.camelCase(vm.path);
            $http({
                method: 'DELETE',
                url: `/deploy/${path}`,
                responseType: 'json'
            }).then(res => {
                if (res.data) {
                    vm.message = res.data.message;
                    vm.disableStop = true;
                    if (res.status === 200) {
                        vm.error = false;
                    } else {
                        vm.error = true;
                    }
                }
            }).catch(err => {
                console.log('ERROR:', err);
            });
        };
        vm.loadLogs = () => {
            var path = vm.camelCase(vm.path);
            $http({
                method: 'GET',
                url: `/${path}/console`,
                headers: {
                    'content-type': 'application/json'
                },
                data: ''
            }).then(res => {
                if (res.data) {
                    if (res.data.logs) {
                        vm.logs = res.data.logs;
                    } else {
                        vm.logs = [];
                    }
                }
            }).catch(err => {
                console.log('ERROR:', err);
            });
        };
        vm.clearLogs = () => {
            var path = vm.camelCase(vm.path);
            $http({
                method: 'DELETE',
                url: `/logs/${path}`,
                headers: {
                    'content-type': 'application/json'
                }
            }).then(res => {
                vm.logs = [];
            }).catch(err => {
                console.log('ERROR:', err);
            });
        };
        var intVal;
        vm.toggleAutoRefresh = (flag) => {
            if (flag) {
                intVal = setInterval(vm.loadLogs, 3000);
            } else {
                clearInterval(intVal);
            }
        };
        vm.copyToClipboard = () => {
            var copyText = document.getElementById('copyUrl');
            copyText.select();
            document.execCommand('copy');
            $('#copied').text('(Copied!)');
            setTimeout(() => {
                $('#copied').text('(Copy to clipboard)');
            }, 2000);
        };
        vm.init();
        vm.activate();
    }
})();