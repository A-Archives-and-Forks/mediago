package server

import (
	"net/http"

	"caorushizi.cn/mediago/internal/api/dto"
	"caorushizi.cn/mediago/internal/service"
	"github.com/gin-gonic/gin"
)

// DownloadService returns the persistence-backed download service shared by
// the HTTP API and MCP server. It is nil when Core runs without a database.
func (s *Server) DownloadService() *service.DownloadTaskService {
	return s.downloadService
}

// RegisterMCPStatusRoute exposes the MCP listener's actual runtime state.
// It must be called before Run.
func (s *Server) RegisterMCPStatusRoute(provider func() any) {
	s.engine.GET("/api/mcp/status", func(c *gin.Context) {
		c.JSON(http.StatusOK, dto.SuccessResponse{
			Success: true,
			Code:    http.StatusOK,
			Message: "OK",
			Data:    provider(),
		})
	})
}
