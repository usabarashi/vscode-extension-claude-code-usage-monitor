{
  description = "VSCode Extension Development Environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    {
      self,
      nixpkgs,
      flake-utils,
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in
      {
        devShells.default = pkgs.mkShell {
          name = "vscode-extension-dev";

          buildInputs = with pkgs; [
            nodejs_24
            nodePackages.typescript
            nodePackages.typescript-language-server
            vsce
          ];

          NODE_PATH = "./node_modules";
          NPM_CONFIG_PREFIX = "";
        };
      }
    );
}
