use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager,
};

/// 退出标记：置于全局状态后，窗口关闭事件不再拦截
#[derive(Default)]
pub struct Quitting;

pub fn create_tray(app: &AppHandle) -> tauri::Result<()> {
    let show_main = MenuItem::with_id(app, "show_main", "显示主窗口", true, None::<&str>)?;
    let open_floating =
        MenuItem::with_id(app, "open_floating", "显示/隐藏悬浮窗", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
    let sep = PredefinedMenuItem::separator(app)?;

    let menu = Menu::with_items(app, &[&show_main, &open_floating, &sep, &quit])?;

    // 托盘图标：使用独立的 tray-icon.png（编译期内嵌，随应用打包）
    let icon = decode_png_icon(include_bytes!("../icons/tray-icon.png"))
        .map_err(|e| tauri::Error::from(std::io::Error::other(e.to_string())))?;

    let _tray = TrayIconBuilder::with_id("main-tray")
        .icon(icon)
        .tooltip("日历 · Calendar")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "show_main" => show_main_window(app),
            "open_floating" => {
                let _ = crate::floating::toggle(app);
            }

            "quit" => {
                app.manage(Quitting::default());
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main_window(tray.app_handle());
            }
        })
        .build(app)?;

    Ok(())
}

pub fn show_main_window(app: &AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.unminimize();
        let _ = win.set_focus();
    }
}

/// 解码 PNG 为 RGBA 图标（托盘图标 32×32，编译期内嵌）
fn decode_png_icon(
    bytes: &[u8],
) -> Result<tauri::image::Image<'static>, Box<dyn std::error::Error>> {
    let decoder = png::Decoder::new(bytes);
    let mut reader = decoder.read_info()?;
    if reader.info().bit_depth != png::BitDepth::Eight {
        return Err("托盘图标仅支持 8 位色深 PNG".into());
    }
    let mut buf = vec![0u8; reader.output_buffer_size()];
    let palette = reader.info().palette.clone();
    let trns = reader.info().trns.clone();
    let info = reader.next_frame(&mut buf)?;
    let (width, height) = (info.width, info.height);
    let rgba: Vec<u8> = match info.color_type {
        png::ColorType::Rgba => buf,
        png::ColorType::Rgb => buf
            .chunks_exact(3)
            .flat_map(|p| [p[0], p[1], p[2], 255])
            .collect(),
        png::ColorType::GrayscaleAlpha => buf
            .chunks_exact(2)
            .flat_map(|p| [p[0], p[0], p[0], p[1]])
            .collect(),
        png::ColorType::Grayscale => buf.iter().flat_map(|&v| [v, v, v, 255]).collect(),
        png::ColorType::Indexed => {
            let palette = palette.ok_or("调色板 PNG 缺少调色板")?;
            let trns = trns.as_deref();
            let mut out = Vec::with_capacity(buf.len() * 4);
            for &idx in &buf {
                let i = idx as usize;
                let p = &palette[i * 3..i * 3 + 3];
                let a = trns.and_then(|t| t.get(i)).copied().unwrap_or(255);
                out.extend_from_slice(&[p[0], p[1], p[2], a]);
            }
            out
        }
    };
    Ok(tauri::image::Image::new_owned(rgba, width, height))
}
