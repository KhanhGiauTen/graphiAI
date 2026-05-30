from pydantic import BaseModel


class DemoDataset(BaseModel):
    id: str
    name: str
    filename: str
    domain: str
    description: str
    suggested_task: str
    rows: int


class DemoDatasetCreateResponse(BaseModel):
    project_id: str
    dataset: DemoDataset
    status: str
