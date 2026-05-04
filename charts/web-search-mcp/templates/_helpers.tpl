{{- define "web-search-mcp.name" -}}
{{- .Chart.Name -}}
{{- end -}}

{{- define "web-search-mcp.fullname" -}}
{{- printf "%s-%s" .Release.Name .Chart.Name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
