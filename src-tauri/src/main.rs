#![windows_subsystem = "windows"]
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{io::{BufRead, BufReader}, sync::{Arc, Mutex}, time::Duration};
use tauri::Manager;
const DEFAULT: &str = "http://127.0.0.1:20128";
#[derive(Clone, Serialize, Deserialize, Debug)]
struct Status { state: String, active: u64, model: String, detail: String, endpoint: String, input_tokens: Option<u64>, output_tokens: Option<u64> }
impl Status {
 fn offline(endpoint: &str, detail: &str) -> Self { Self { state:"offline".into(),active:0,model:String::new(),detail:detail.into(),endpoint:endpoint.into(),input_tokens:None,output_tokens:None } }
}
#[derive(Clone)]
struct Monitor(Arc<Mutex<Status>>);
fn validate_endpoint(input: &str) -> Result<String, String> {
 let u = url::Url::parse(input.trim()).map_err(|_| "URL tidak valid")?;
 // CLI credential is NEVER sent outside the exact local router origin.
 if u.scheme() != "http" || !matches!(u.host_str(),Some("localhost"|"127.0.0.1")) || u.port_or_known_default()!=Some(20128) || !u.username().is_empty() || u.password().is_some() || u.query().is_some() || u.fragment().is_some() || u.path()!="/" { return Err("Gunakan http://127.0.0.1:20128 atau http://localhost:20128".into()); }
 Ok(u.as_str().trim_end_matches('/').into())
}
fn cli_token() -> Option<String> {
 let p = std::path::PathBuf::from(std::env::var("APPDATA").ok()?).join("9router");
 let machine=std::fs::read_to_string(p.join("machine-id")).ok()?;
 let secret=std::fs::read_to_string(p.join("auth/cli-secret")).ok()?;
 Some(format!("{:x}",Sha256::digest(format!("{}9r-cli-auth{}",machine.trim(),secret.trim())))[..16].into())
}
fn parse_status(value: &serde_json::Value, endpoint: &str) -> Result<Status,String> {
 let list=value.get("activeRequests").and_then(|v|v.as_array()).ok_or("Format activeRequests tidak dikenal")?;
 let active=list.iter().map(|v|v.get("count").and_then(|n|n.as_u64()).unwrap_or(0)).sum::<u64>();
 let model=list.iter().find(|v|v["count"].as_u64().unwrap_or(0)>0).and_then(|v|v["model"].as_str()).unwrap_or("").to_string();
 Ok(Status{state:if active>0{"working"}else{"idle"}.into(),active,model,detail:if active>0 {format!("{active} request sedang diproses")}else{"Terhubung · menunggu request".into()},endpoint:endpoint.into(),input_tokens:None,output_tokens:None})
}
fn publish(m: &Monitor, endpoint:&str, value:Status) { let mut s=m.0.lock().unwrap(); if s.endpoint==endpoint { let mut value=value; value.input_tokens=s.input_tokens; value.output_tokens=s.output_tokens; *s=value; } }
fn daily_tokens(m:Monitor) {
 std::thread::spawn(move || {
 let agent=ureq::AgentBuilder::new().timeout(Duration::from_secs(5)).redirects(0).build();
 loop {
 let endpoint=m.0.lock().unwrap().endpoint.clone();
 let result=(|| -> Option<(u64,u64)> {
 let token=cli_token()?;
 let response=agent.get(&format!("{endpoint}/api/usage/stats?period=today")).set("x-9r-cli-token",&token).call().ok()?;
 let value:serde_json::Value=serde_json::from_reader(response.into_reader()).ok()?;
 Some((value["totalPromptTokens"].as_u64()?,value["totalCompletionTokens"].as_u64()?))
 })();
 let mut s=m.0.lock().unwrap();
 if s.endpoint==endpoint { s.input_tokens=result.map(|v|v.0);s.output_tokens=result.map(|v|v.1); }
 drop(s);
 std::thread::sleep(Duration::from_secs(5));
 }
 });
}
fn monitor(m:Monitor) {
 std::thread::spawn(move || {
 let agent=ureq::AgentBuilder::new().timeout_connect(Duration::from_secs(3)).timeout_read(Duration::from_secs(35)).redirects(0).build();
 loop {
 let endpoint=m.0.lock().unwrap().endpoint.clone();
 let result=(|| -> Result<(),String> {
 let token=cli_token().ok_or("Kredensial CLI 9router lokal belum tersedia")?;
 let response=agent.get(&format!("{endpoint}/api/usage/stream")).set("x-9r-cli-token",&token).set("Accept","text/event-stream").call().map_err(|e|format!("9router tidak terhubung: {e}"))?;
 if !response.header("Content-Type").unwrap_or("").contains("text/event-stream") {return Err("Respons bukan stream 9router".into())}
 let mut reader=BufReader::new(response.into_reader());
 loop {
 if m.0.lock().unwrap().endpoint!=endpoint {return Ok(())}
 let mut line=String::new();
 if reader.read_line(&mut line).map_err(|_|"Koneksi stream terputus")?==0 {return Err("Stream berakhir; mencoba kembali".into())}
 if line.len()>4_000_000 { return Err("Respons terlalu besar".into()) }
 if let Some(data)=line.strip_prefix("data:") { let value:serde_json::Value=serde_json::from_str(data.trim()).map_err(|_|"JSON stream tidak valid")?; publish(&m,&endpoint,parse_status(&value,&endpoint)?); }
 }
 })();
 if let Err(e)=result {publish(&m,&endpoint,Status::offline(&endpoint,&e));}
 std::thread::sleep(Duration::from_secs(2));
 }
 });
}
#[tauri::command]
fn get_status(m:tauri::State<Monitor>) -> Status {m.0.lock().unwrap().clone()}
fn config_file() -> std::path::PathBuf {std::path::PathBuf::from(std::env::var("LOCALAPPDATA").unwrap_or_else(|_|".".into())).join("com.aimate.widget").join("endpoint.txt")}
#[tauri::command]
fn set_endpoint(endpoint:String,m:tauri::State<Monitor>)->Result<(),String> {
 let endpoint=validate_endpoint(&endpoint)?;
 let p=config_file(); std::fs::create_dir_all(p.parent().unwrap()).map_err(|e|e.to_string())?;std::fs::write(p,&endpoint).map_err(|e|e.to_string())?;
 *m.0.lock().unwrap()=Status::offline(&endpoint,"Menghubungkan ke 9router…"); Ok(())
}
#[tauri::command]
fn quit_app(app:tauri::AppHandle){app.exit(0)}
fn main(){
 let endpoint=std::fs::read_to_string(config_file()).ok().and_then(|s|validate_endpoint(&s).ok()).unwrap_or_else(||DEFAULT.into());
 let m=Monitor(Arc::new(Mutex::new(Status::offline(&endpoint,"Menghubungkan ke 9router…"))));
 daily_tokens(m.clone());
 monitor(m.clone());
 // CLI probe exercises the SAME live SSE monitor without starting a window.
 if std::env::args().any(|s|s=="--probe") {for _ in 0..80 {std::thread::sleep(Duration::from_millis(100));let s=m.0.lock().unwrap().clone();if s.state!="offline" {println!("{}",serde_json::to_string(&s).unwrap());return;}}println!("{}",serde_json::to_string(&*m.0.lock().unwrap()).unwrap());std::process::exit(1)}
 tauri::Builder::default().manage(m).setup(|app|{
 if let Some(w)=app.get_webview_window("main") {if let Ok(Some(mon))=w.current_monitor(){let size=mon.size();let origin=mon.position();let _=w.set_position(tauri::PhysicalPosition::new(origin.x+size.width as i32-400,origin.y+size.height as i32-500));}}
 Ok(())
 }).invoke_handler(tauri::generate_handler![get_status,set_endpoint,quit_app]).run(tauri::generate_context!()).expect("AIMate gagal dijalankan");
}
#[cfg(test)]
mod tests {
 use super::*; use serde_json::json;
 #[test] fn tokens(){let s=parse_status(&json!({"activeRequests":[],"totalPromptTokens":1995316057u64,"totalCompletionTokens":9589527}),DEFAULT).unwrap();assert_eq!(s.input_tokens,None);assert_eq!(s.output_tokens,None);}
 #[test] fn missing_tokens(){let s=parse_status(&json!({"activeRequests":[]}),DEFAULT).unwrap();assert_eq!(s.input_tokens,None);assert_eq!(s.output_tokens,None);}
 #[test] fn idle(){assert_eq!(parse_status(&json!({"activeRequests":[]}),DEFAULT).unwrap().state,"idle");}
 #[test] fn working_sums_concurrency(){let s=parse_status(&json!({"activeRequests":[{"model":"test","count":2},{"model":"other","count":3}]}),DEFAULT).unwrap();assert_eq!(s.active,5);assert_eq!(s.state,"working");assert_eq!(s.model,"test");}
 #[test] fn zero_is_idle(){assert_eq!(parse_status(&json!({"activeRequests":[{"count":0}]}),DEFAULT).unwrap().state,"idle");}
 #[test] fn invalid_is_not_idle(){assert!(parse_status(&json!({"error":"Unauthorized"}),DEFAULT).is_err());}
 #[test] fn origin_lock(){for s in ["https://example.com","http://127.0.0.1:9999","http://127.0.0.1:20128/path","http://a@localhost:20128","http://localhost:20128?x=1"] {assert!(validate_endpoint(s).is_err());}assert!(validate_endpoint(DEFAULT).is_ok());}
}
