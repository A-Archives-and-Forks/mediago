package handler

import (
	"context"
	"errors"
	"net/http"
	"strings"

	"caorushizi.cn/mediago/internal/api/dto"
	"caorushizi.cn/mediago/internal/api/sse"
	"caorushizi.cn/mediago/internal/db"
	"caorushizi.cn/mediago/internal/discovery"
	"caorushizi.cn/mediago/internal/i18n"
	"caorushizi.cn/mediago/internal/service"
	"github.com/gin-gonic/gin"
)

const (
	maxDiscoveryRequestBodyBytes = 64 << 10
	maxDiscoveryURLBytes         = 8 << 10
	maxDiscoveryDownloadSources  = 20
)

var (
	ErrDiscoveryDownloadUnavailable = errors.New("discovery download service unavailable")
	ErrDiscoveryDownloadInvalid     = errors.New("invalid discovery download request")
	ErrDiscoveryJobNotReady         = errors.New("discovery job is not ready for download")
	ErrDiscoverySourceNotFound      = errors.New("discovery source not found")
)

type DiscoveryHandler struct {
	discoverySvc *discovery.Service
	downloadSvc  *service.DownloadTaskService
	conf         ConfigStore
	hub          *sse.Hub
}

func NewDiscoveryHandler(discoverySvc *discovery.Service, downloadSvc *service.DownloadTaskService, conf ConfigStore, hub *sse.Hub) *DiscoveryHandler {
	return &DiscoveryHandler{
		discoverySvc: discoverySvc,
		downloadSvc:  downloadSvc,
		conf:         conf,
		hub:          hub,
	}
}

func (h *DiscoveryHandler) Create(c *gin.Context) {
	limitDiscoveryBody(c)
	var req dto.CreateDiscoveryReq
	if err := c.ShouldBindJSON(&req); err != nil || len(req.URL) > maxDiscoveryURLBytes {
		writeInvalidRequest(c)
		return
	}
	job, err := h.discoverySvc.Create(c.Request.Context(), discovery.CreateDiscoveryInput{
		URL:               req.URL,
		Mode:              req.Mode,
		TimeoutMS:         req.TimeoutMS,
		UseSessionCookies: req.UseSessionCookies,
	})
	if err != nil {
		writeDiscoveryDomainError(c, err)
		return
	}
	status := http.StatusOK
	if job.Status == discovery.StatusPending || job.Status == discovery.StatusRunning {
		status = http.StatusAccepted
	}
	writeDiscoverySuccess(c, status, job)
}

func (h *DiscoveryHandler) Get(c *gin.Context) {
	job, err := h.discoverySvc.Get(c.Param("id"))
	if err != nil {
		writeDiscoveryDomainError(c, err)
		return
	}
	writeDiscoverySuccess(c, http.StatusOK, job)
}

func (h *DiscoveryHandler) Cancel(c *gin.Context) {
	job, err := h.discoverySvc.Cancel(c.Request.Context(), c.Param("id"))
	if err != nil {
		writeDiscoveryDomainError(c, err)
		return
	}
	writeDiscoverySuccess(c, http.StatusOK, job)
}

func (h *DiscoveryHandler) ExecutorStatus(c *gin.Context) {
	writeDiscoverySuccess(c, http.StatusOK, h.discoverySvc.ExecutorStatus())
}

func (h *DiscoveryHandler) Downloads(c *gin.Context) {
	limitDiscoveryBody(c)
	var req dto.CreateDiscoveryDownloadsReq
	if err := c.ShouldBindJSON(&req); err != nil || len(req.SourceIDs) == 0 || len(req.SourceIDs) > maxDiscoveryDownloadSources {
		writeInvalidRequest(c)
		return
	}
	startDownload := req.StartDownload == nil || *req.StartDownload
	videos, err := h.CreateDownloads(c.Request.Context(), c.Param("id"), req.SourceIDs, req.Folder, startDownload)
	if err != nil {
		switch {
		case errors.Is(err, ErrDiscoveryDownloadUnavailable):
			writeErrorResponse(c, http.StatusServiceUnavailable, "discovery_download_unavailable", i18n.T(c, i18n.MsgDiscoveryDownloadUnavailable))
		case errors.Is(err, ErrDiscoveryDownloadInvalid):
			writeInvalidRequest(c)
		case errors.Is(err, ErrDiscoveryJobNotReady):
			writeErrorResponse(c, http.StatusConflict, "discovery_invalid_transition", i18n.T(c, i18n.MsgDiscoveryInvalidState))
		case errors.Is(err, ErrDiscoverySourceNotFound):
			writeErrorResponse(c, http.StatusNotFound, "discovery_source_not_found", i18n.T(c, i18n.MsgDiscoverySourceNotFound))
		case errors.Is(err, service.ErrDownloadURLAlreadyExists):
			writeErrorResponse(c, http.StatusConflict, "discovery_download_exists", i18n.T(c, i18n.MsgURLAlreadyExists))
		case errors.Is(err, discovery.ErrNotFound):
			writeDiscoveryDomainError(c, err)
		default:
			writeInternalError(c)
		}
		return
	}
	writeDiscoverySuccess(c, http.StatusOK, videos)
}

// CreateDownloads is the shared discovery-to-download handoff used by HTTP
// and MCP. Sensitive browser credentials stay in memory and are only supplied
// to active queue workers; persisted records receive the safe header subset.
func (h *DiscoveryHandler) CreateDownloads(_ context.Context, jobID string, sourceIDs []string, folderName string, startDownload bool) ([]*db.Video, error) {
	if h.downloadSvc == nil {
		return nil, ErrDiscoveryDownloadUnavailable
	}
	if len(sourceIDs) == 0 || len(sourceIDs) > maxDiscoveryDownloadSources {
		return nil, ErrDiscoveryDownloadInvalid
	}
	job, err := h.discoverySvc.Get(jobID)
	if err != nil {
		return nil, err
	}
	if job.Status != discovery.StatusCompleted && job.Status != discovery.StatusFailed {
		return nil, ErrDiscoveryJobNotReady
	}

	sources := make(map[string]discovery.DiscoverySource, len(job.Sources))
	for _, source := range job.Sources {
		sources[source.ID] = source
	}
	seen := make(map[string]struct{}, len(sourceIDs))
	inputs := make([]*service.AddDownloadTaskInput, 0, len(sourceIDs))
	runtimeHeaders := make([][]string, 0, len(sourceIDs))
	for _, rawSourceID := range sourceIDs {
		sourceID := strings.TrimSpace(rawSourceID)
		source, ok := sources[sourceID]
		if !ok {
			return nil, ErrDiscoverySourceNotFound
		}
		if _, duplicate := seen[sourceID]; duplicate {
			return nil, ErrDiscoveryDownloadInvalid
		}
		seen[sourceID] = struct{}{}
		headers, _ := h.discoverySvc.PrivateHeaders(job.ID, sourceID)
		var folder *string
		if folderName != "" {
			value := folderName
			folder = &value
		}
		inputs = append(inputs, &service.AddDownloadTaskInput{
			Name:    source.Title,
			Type:    string(source.Type),
			URL:     source.URL,
			Headers: service.PersistentDiscoveryHeaders(headers),
			Folder:  folder,
		})
		runtimeHeaders = append(runtimeHeaders, headers)
	}

	videos, err := h.downloadSvc.AddDownloadTasks(inputs)
	if err != nil {
		return nil, err
	}
	if startDownload {
		localPath, _ := h.conf.Get("local").(string)
		deleteSegments, _ := h.conf.Get("deleteSegments").(bool)
		for index, video := range videos {
			if err := h.downloadSvc.StartDownloadWithRuntimeHeaders(video.ID, localPath, deleteSegments, runtimeHeaders[index]); err != nil {
				return nil, err
			}
		}
	}
	if h.hub != nil && len(videos) > 0 {
		ids := make([]int64, 0, len(videos))
		for _, video := range videos {
			ids = append(ids, video.ID)
		}
		h.hub.Broadcast("download-create", map[string]any{"ids": ids, "count": len(ids)})
	}
	return videos, nil
}

func limitDiscoveryBody(c *gin.Context) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxDiscoveryRequestBodyBytes)
}

func writeDiscoveryDomainError(c *gin.Context, err error) {
	status := http.StatusBadRequest
	message := err.Error()
	switch {
	case errors.Is(err, discovery.ErrNotFound):
		status = http.StatusNotFound
		message = i18n.T(c, i18n.MsgDiscoveryNotFound)
	case errors.Is(err, discovery.ErrExecutorUnavailable):
		status = http.StatusConflict
		message = i18n.T(c, i18n.MsgDiscoveryExecutorUnavailable)
	case errors.Is(err, discovery.ErrQueueFull):
		status = http.StatusTooManyRequests
		message = i18n.T(c, i18n.MsgDiscoveryQueueFull)
	case errors.Is(err, discovery.ErrInspectorUnavailable):
		status = http.StatusServiceUnavailable
		message = i18n.T(c, i18n.MsgDiscoveryInspectorUnavailable)
	case errors.Is(err, discovery.ErrInvalidTransition):
		status = http.StatusConflict
		message = i18n.T(c, i18n.MsgDiscoveryInvalidState)
	case errors.Is(err, discovery.ErrInvalidURL):
		message = i18n.T(c, i18n.MsgDiscoveryInvalidURL)
	case errors.Is(err, discovery.ErrInvalidMode):
		message = i18n.T(c, i18n.MsgDiscoveryInvalidMode)
	case errors.Is(err, discovery.ErrInvalidInspectURL):
		message = i18n.T(c, i18n.MsgDiscoveryInvalidInspectURL)
	}
	writeErrorResponse(c, status, discovery.ErrorCode(err), message)
}

func writeDiscoverySuccess(c *gin.Context, status int, data any) {
	c.JSON(status, dto.SuccessResponse{
		Success: true,
		Code:    status,
		Message: i18n.T(c, i18n.MsgOK),
		Data:    data,
	})
}
