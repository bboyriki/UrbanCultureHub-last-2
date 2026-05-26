{pkgs}: {
  deps = [
    pkgs.nodejs_20
    pkgs.nodePackages.npm
    pkgs.jq
    pkgs.postgresql
  ];
}
