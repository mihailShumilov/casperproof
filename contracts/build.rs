//! Build script: declares the `odra_module` cfg + flags consumed by `cargo odra build`
//! when compiling each contract to wasm. For `cargo test` (MockVM) it is a no-op beyond
//! the cfg declaration.
fn main() {
    odra_build::build();
}
