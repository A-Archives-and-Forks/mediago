package dto

import (
	"testing"

	"caorushizi.cn/mediago/internal/core"
)

func TestCreateTaskReqInfersTypeWhenOmitted(t *testing.T) {
	req := CreateTaskReq{
		URL:  "https://x.com/mediago/status/1234567890",
		Name: "x-video",
	}
	if got := req.ToDownloadParams().Type; got != core.TypeYoutube {
		t.Fatalf("ToDownloadParams().Type = %q, want %q", got, core.TypeYoutube)
	}
}

func TestCreateTaskReqPreservesExplicitType(t *testing.T) {
	req := CreateTaskReq{
		Type: core.TypeDirect,
		URL:  "https://x.com/mediago/status/1234567890",
		Name: "x-video",
	}
	if got := req.ToDownloadParams().Type; got != core.TypeDirect {
		t.Fatalf("ToDownloadParams().Type = %q, want %q", got, core.TypeDirect)
	}
}
