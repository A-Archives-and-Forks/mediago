package app

import (
	"bytes"
	"encoding/json"
	"testing"
)

func TestAppConfigReadsButNeverSerializesElectronBridgeToken(t *testing.T) {
	t.Setenv("MEDIAGO_ELECTRON_BRIDGE_TOKEN", "sentinel-bridge-token")
	cfg := DefaultConfig()
	cfg.ApplyEnvAndDefaults()
	if cfg.ElectronBridgeToken != "sentinel-bridge-token" {
		t.Fatalf("ElectronBridgeToken = %q", cfg.ElectronBridgeToken)
	}
	encoded, err := json.Marshal(cfg)
	if err != nil {
		t.Fatal(err)
	}
	if bytes.Contains(encoded, []byte("sentinel-bridge-token")) {
		t.Fatalf("serialized config leaked bridge token: %s", encoded)
	}
}
