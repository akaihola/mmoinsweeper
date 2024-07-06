use std::fs::File;
use std::io::Read;

use openssl::x509::X509;

pub fn show_hostnames(port: u16) {
    // Read the certificate file
    let mut cert_file = File::open("cert.pem").unwrap();
    let mut cert_contents = Vec::new();
    cert_file.read_to_end(&mut cert_contents).unwrap();

    // Parse the certificate
    let cert = X509::from_pem(&cert_contents).unwrap();

    // Extract and print the subject (which includes the Common Name)
    let subject = cert.subject_name();
    for entry in subject.entries() {
        if entry.object().nid().as_raw() == openssl::nid::Nid::COMMONNAME.as_raw() {
            if let Ok(common_name) = entry.data().as_utf8() {
                println!("Common Name: https://{}:{}", common_name, port);
            }
        }
    }

    // Extract and print the Subject Alternative Names (SANs)
    if let Some(sans) = cert.subject_alt_names() {
        println!("Subject Alternative Names:");
        for san in sans.iter() {
            if let Some(domain) = san.dnsname() {
                println!("  DNS: https://{}:{}", domain, port);
            }
        }
    }
}