{
  nixConfig.bash-prompt-prefix = "[airsonic-refix-jukebox] ";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-23.11";
    systems.url = "github:nix-systems/default-linux";
  };

  outputs = { self, nixpkgs, systems }:
    let
      forAllSystems = f: nixpkgs.lib.genAttrs (import systems) (system: f {
        inherit system;
        pkgs = nixpkgs.legacyPackages.${system};
      });
    in {
      devShell = forAllSystems ({ pkgs, ... }:
        pkgs.mkShell {
          buildInputs = [
            pkgs.nodejs
            pkgs.nodejs.pkgs.yarn
          ];
        }
      );

      packages = forAllSystems ({ pkgs, ... }: {
        default = pkgs.callPackage ./. { };
      });
    };
}
