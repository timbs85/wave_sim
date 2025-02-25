System.config({
    baseURL: '/',
    defaultExtension: 'js',
    packages: {
        './': {
            defaultExtension: 'js'
        }
    },
    meta: {
        './imgui-js/dist/*.js': {
            format: 'umd'
        }
    },
    map: {
        'imgui-js': './imgui-js/dist/imgui.umd.js',
        'imgui-impl': './imgui-js/dist/imgui_impl.umd.js'
    }
}); 