//! Entry point used by `cargo odra build` to emit contract schema (CEP-78/casper schema).
fn main() {
    odra_build::build_schema();
}
